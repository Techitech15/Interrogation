import type { AIProvider, TestimonyRequest, TestimonyResponse } from "./AIProvider";
import { InvalidResponseError } from "./AIProvider";
import { RateLimitError } from "./GeminiBYOKProvider";
import { validateTestimony } from "./responseValidator";

export type FallbackReason = "rate_limit" | "network" | "invalid_response" | "validation_failed" | null;

export interface RoutedTestimony {
  /** null = レイヤーAへフォールバックせよ */
  response: TestimonyResponse | null;
  usedLayer: "B" | "C" | null;
  fallbackReason: FallbackReason;
}

export interface AIProviderRouterOptions {
  streamerMode: boolean;
  sleeper?: (ms: number) => Promise<void>;
}

const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

function defaultSleeper(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AIProviderRouter {
  private readonly providers: AIProvider[];
  private readonly streamerMode: boolean;
  private readonly sleeper: (ms: number) => Promise<void>;

  constructor(providers: AIProvider[], opts: AIProviderRouterOptions) {
    this.providers = providers;
    this.streamerMode = opts.streamerMode;
    this.sleeper = opts.sleeper ?? defaultSleeper;
  }

  async generateTestimony(req: TestimonyRequest): Promise<RoutedTestimony> {
    const provider = await this.selectProvider();

    if (!provider) {
      return { response: null, usedLayer: null, fallbackReason: "network" };
    }

    let rawResponse: TestimonyResponse;
    try {
      rawResponse = await this.generateWithRetry(provider, req);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { response: null, usedLayer: null, fallbackReason: "rate_limit" };
      }
      if (err instanceof InvalidResponseError) {
        return { response: null, usedLayer: null, fallbackReason: "invalid_response" };
      }
      return { response: null, usedLayer: null, fallbackReason: "network" };
    }

    const isValid = validateTestimony(rawResponse.lineText, {
      bannedKeywords: req.aiProfile.bannedKeywords,
      streamerMode: this.streamerMode,
    });

    if (!isValid) {
      return { response: null, usedLayer: null, fallbackReason: "validation_failed" };
    }

    return { response: rawResponse, usedLayer: provider.layer, fallbackReason: null };
  }

  private async selectProvider(): Promise<AIProvider | null> {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }

  /**
   * RateLimitError発生時のみ指数バックオフ(1s→2s→4s)で最大3回リトライする。
   * それ以外の例外は即座に呼び出し元へ伝播する。
   */
  private async generateWithRetry(
    provider: AIProvider,
    req: TestimonyRequest,
  ): Promise<TestimonyResponse> {
    let attempt = 0;

    while (true) {
      try {
        return await provider.generateTestimony(req);
      } catch (err) {
        if (!(err instanceof RateLimitError)) {
          throw err;
        }
        const delay = BACKOFF_DELAYS_MS[attempt];
        if (delay === undefined) {
          throw err;
        }
        await this.sleeper(delay);
        attempt += 1;
      }
    }
  }
}
