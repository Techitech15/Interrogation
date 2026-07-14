import type { AIProvider, TestimonyRequest, TestimonyResponse } from "./AIProvider";
import { InvalidResponseError, buildSystemPrompt, buildUserPrompt } from "./AIProvider";

const DEFAULT_MODEL = "gemini-2.5-flash";

export class RateLimitError extends Error {
  constructor(message = "Gemini API rate limit exceeded (HTTP 429)") {
    super(message);
    this.name = "RateLimitError";
  }
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function isEmotionDelta(value: unknown): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function parseTestimonyResponse(rawText: string): TestimonyResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new InvalidResponseError("GeminiBYOKProvider: failed to parse response JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).line !== "string" ||
    !isEmotionDelta((parsed as Record<string, unknown>).emotionDelta)
  ) {
    throw new InvalidResponseError(
      "GeminiBYOKProvider: response JSON does not match TestimonyResponse shape",
    );
  }

  const line = (parsed as { line: string }).line;
  const emotionDelta = (parsed as { emotionDelta: -1 | 0 | 1 }).emotionDelta;

  return { lineText: line, emotionDelta };
}

export class GeminiBYOKProvider implements AIProvider {
  readonly layer = "B" as const;

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0;
  }

  async generateTestimony(req: TestimonyRequest): Promise<TestimonyResponse> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    const systemPrompt = buildSystemPrompt(req);
    const userPrompt = buildUserPrompt(req);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    if (response.status === 429) {
      throw new RateLimitError();
    }

    if (!response.ok) {
      throw new Error(`GeminiBYOKProvider: request failed with status ${response.status}`);
    }

    const body = (await response.json()) as GeminiResponseBody;
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string") {
      throw new InvalidResponseError(
        "GeminiBYOKProvider: response is missing candidates[0].content.parts[0].text",
      );
    }

    return parseTestimonyResponse(text);
  }
}
