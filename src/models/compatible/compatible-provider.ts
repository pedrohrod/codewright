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
// OpenAI-compatible API types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
}

interface ChatCompletionChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: { message: string; type: string; code: string };
}

// ---------------------------------------------------------------------------
// OpenAI-compatible language model
// ---------------------------------------------------------------------------

const PROVIDER_NAME = "openai-compatible";

export class CompatibleLanguageModel implements LanguageModel {
  readonly name = PROVIDER_NAME;
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor(config: ModelConfig & { baseURL: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL.replace(/\/+$/, "");
    this.timeout = config.timeout ?? 60_000;
    this.modelId = config.model;
  }

  async generate(options: ModelCallOptions): Promise<ModelResponse> {
    const { messages, temperature, maxTokens, stop } = options;

    const body: ChatCompletionRequest = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens !== undefined) body.max_tokens = maxTokens;
    if (stop !== undefined && stop.length > 0) body.stop = stop;

    const url = `${this.baseURL}/chat/completions`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
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

    let data: ChatCompletionResponse;
    try {
      data = (await response.json()) as ChatCompletionResponse;
    } catch {
      throw new ModelResponseError(PROVIDER_NAME, "Invalid JSON response");
    }

    // Check for API-level errors in the response body
    if (data.error) {
      throw new ModelError(
        `API error: ${data.error.message}`,
        PROVIDER_NAME,
      );
    }

    const choice = data.choices?.[0];
    if (!choice) {
      throw new ModelResponseError(PROVIDER_NAME, "No choices in response");
    }

    const content = choice.message?.content ?? "";

    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    return {
      content,
      usage,
      model: this.model,
      finishReason: choice.finish_reason,
    };
  }

  private async handleError(response: Response): Promise<never> {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;

    let bodyText: string;
    try {
      const body = await response.json() as ChatCompletionResponse;
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
          `API error (${response.status}): ${bodyText}`,
          PROVIDER_NAME,
        );
    }
  }
}

// ---------------------------------------------------------------------------
// Provider + factory
// ---------------------------------------------------------------------------

export interface CompatibleProvider extends ModelProvider {
  readonly name: "openai-compatible";
  createModel(config: ModelConfig & { baseURL: string }): CompatibleLanguageModel;
}

function validateConfig(config: ModelConfig & { baseURL: string }): void {
  if (!config.apiKey) {
    throw new ModelAuthenticationError(PROVIDER_NAME, "Missing API key");
  }
  if (!config.baseURL) {
    throw new ModelError("Missing baseURL", PROVIDER_NAME);
  }
  if (!config.model) {
    throw new ModelError("Missing model identifier", PROVIDER_NAME);
  }
}

export function openaiCompatible(config: ModelConfig & { baseURL: string }): CompatibleProvider {
  validateConfig(config);

  return {
    name: "openai-compatible" as const,
    createModel(modelConfig: ModelConfig & { baseURL: string }): CompatibleLanguageModel {
      return new CompatibleLanguageModel({ ...config, ...modelConfig });
    },
    validate() {
      validateConfig(config);
    },
  };
}
