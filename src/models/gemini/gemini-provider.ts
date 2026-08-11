import type {
  LanguageModel,
  ModelCallOptions,
  ModelResponse,
} from "../language-model.js";
import type { ModelConfig, ModelProvider } from "../model-provider.js";
import {
  ModelAuthenticationError,
  ModelResponseError,
  ModelRateLimitError,
  ModelTimeoutError,
  ModelError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Gemini API types
// ---------------------------------------------------------------------------

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiGenerateRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  error?: { code: number; message: string; status: string };
}

// ---------------------------------------------------------------------------
// Gemini language model
// ---------------------------------------------------------------------------

const PROVIDER_NAME = "gemini";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

export class GeminiLanguageModel implements LanguageModel {
  readonly name = PROVIDER_NAME;
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor(config: ModelConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? 60_000;
    this.modelId = config.model;
  }

  async generate(options: ModelCallOptions): Promise<ModelResponse> {
    const { messages, temperature, maxTokens } = options;

    // Separate system messages from conversation
    const systemMessages: string[] = [];
    const contents: GeminiContent[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemMessages.push(msg.content);
        continue;
      }

      const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";

      // Merge consecutive messages with same role
      const last = contents[contents.length - 1];
      if (last && last.role === role) {
        last.parts.push({ text: msg.content });
      } else {
        contents.push({ role, parts: [{ text: msg.content }] });
      }
    }

    const body: GeminiGenerateRequest = { contents };

    if (systemMessages.length > 0) {
      body.systemInstruction = { parts: [{ text: systemMessages.join("\n\n") }] };
    }

    if (temperature !== undefined || maxTokens !== undefined) {
      body.generationConfig = {};
      if (temperature !== undefined) body.generationConfig.temperature = temperature;
      if (maxTokens !== undefined) body.generationConfig.maxOutputTokens = maxTokens;
    }

    const url = `${this.baseURL}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ModelTimeoutError(PROVIDER_NAME, this.timeout);
      }
      throw new ModelError(
        `Request failed: ${err instanceof Error ? err.message : String(err)}`,
        PROVIDER_NAME,
        err instanceof Error ? err : undefined,
      );
    }

    // Handle error responses
    if (!response.ok) {
      await this.handleError(response);
    }

    let data: GeminiGenerateResponse;
    try {
      data = (await response.json()) as GeminiGenerateResponse;
    } catch {
      throw new ModelResponseError(PROVIDER_NAME, "Invalid JSON response");
    }

    // Check for API-level errors in the response body
    if (data.error) {
      throw new ModelError(
        `Gemini API error: ${data.error.message}`,
        PROVIDER_NAME,
      );
    }

    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new ModelResponseError(PROVIDER_NAME, "No content in response");
    }

    const content = candidate.content.parts.map((p) => p.text).join("");

    const usage = data.usageMetadata
      ? {
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    return {
      content,
      usage,
      model: this.model,
      finishReason: candidate.finishReason,
    };
  }

  private async handleError(response: Response): Promise<never> {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;

    // Try to extract error message from body
    let bodyText: string;
    try {
      const body = await response.json() as GeminiGenerateResponse;
      bodyText = body.error?.message ?? "";
    } catch {
      bodyText = await response.text().catch(() => "Unknown error");
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ModelAuthenticationError(PROVIDER_NAME);
      case 429:
        throw new ModelRateLimitError(PROVIDER_NAME, retryAfterMs);
      default:
        throw new ModelError(
          `Gemini API error (${response.status}): ${bodyText}`,
          PROVIDER_NAME,
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Provider + factory
// ---------------------------------------------------------------------------

export interface GeminiProvider extends ModelProvider {
  readonly name: "gemini";
  createModel(config: ModelConfig): GeminiLanguageModel;
}

function validateConfig(config: ModelConfig): void {
  if (!config.apiKey) {
    throw new ModelAuthenticationError(PROVIDER_NAME, "Missing API key");
  }
  if (!config.model) {
    throw new ModelError("Missing model identifier", PROVIDER_NAME);
  }
}

export function gemini(config: ModelConfig): GeminiProvider {
  validateConfig(config);

  return {
    name: "gemini" as const,
    createModel(modelConfig: ModelConfig): GeminiLanguageModel {
      return new GeminiLanguageModel({ ...config, ...modelConfig });
    },
    validate() {
      validateConfig(config);
    },
  };
}
