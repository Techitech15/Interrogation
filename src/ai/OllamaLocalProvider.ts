import type { AIProvider, TestimonyRequest, TestimonyResponse } from "./AIProvider";
import { InvalidResponseError, buildSystemPrompt, buildUserPrompt } from "./AIProvider";

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen3";
const AVAILABILITY_TIMEOUT_MS = 2000;

interface OllamaChatResponseBody {
  message?: {
    content?: string;
  };
}

function isEmotionDelta(value: unknown): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function parseTestimonyResponse(rawText: string): TestimonyResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new InvalidResponseError("OllamaLocalProvider: failed to parse response JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).line !== "string" ||
    !isEmotionDelta((parsed as Record<string, unknown>).emotionDelta)
  ) {
    throw new InvalidResponseError(
      "OllamaLocalProvider: response JSON does not match TestimonyResponse shape",
    );
  }

  const line = (parsed as { line: string }).line;
  const emotionDelta = (parsed as { emotionDelta: -1 | 0 | 1 }).emotionDelta;

  return { lineText: line, emotionDelta };
}

export class OllamaLocalProvider implements AIProvider {
  readonly layer = "C" as const;

  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL, model: string = DEFAULT_MODEL) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      return response.status === 200;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateTestimony(req: TestimonyRequest): Promise<TestimonyResponse> {
    const systemPrompt = buildSystemPrompt(req);
    const userPrompt = buildUserPrompt(req);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(`OllamaLocalProvider: request failed with status ${response.status}`);
    }

    const body = (await response.json()) as OllamaChatResponseBody;
    const content = body.message?.content;

    if (typeof content !== "string") {
      throw new InvalidResponseError("OllamaLocalProvider: response is missing message.content");
    }

    return parseTestimonyResponse(content);
  }
}
