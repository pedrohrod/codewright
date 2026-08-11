import type { ModelConfig, ModelProvider } from "../model-provider.js";
import type {
  LanguageModel,
  ModelCallOptions,
  ModelResponse,
} from "../language-model.js";
import {
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelNotFoundError,
  ModelTimeoutError,
  ModelError,
  ModelResponseError,
} from "../errors.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT = 120_000;

// ---------------------------------------------------------------------------
// Types for OpenAI API shapes
// ---------------------------------------------------------------------------

interface OpenAIRequestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIRequestMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChoice {
  message: { content: string };
  finish_reason: string;
}

interface OpenAIChatCompletionResponse {
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
  model: string;
}

// ---------------------------------------------------------------------------
// OpenAI Language Model
// ---------------------------------------------------------------------------

class OpenAILanguageModel implements LanguageModel {
  readonly name: string;
  readonly modelId: string;

  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly temperature?: number;
  private readonly maxTokens?: number;
  private readonly timeout: number;

  constructor(config: ModelConfig) {
    this.name = "openai";
    this.modelId = config.model;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL ?? DEFAULT_BASE_URL;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  async generate(options: ModelCallOptions): Promise<ModelResponse> {
    const { messages, temperature, maxTokens, jsonMode } = options;

    const body: OpenAIChatCompletionRequest = {
      model: this.modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (temperature !== undefined) {
      body.temperature = temperature;
    } else if (this.temperature !== undefined) {
      body.temperature = this.temperature;
    }

    if (maxTokens !== undefined) {
      body.max_tokens = maxTokens;
    } else if (this.maxTokens !== undefined) {
      body.max_tokens = this.maxTokens;
    }

    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `${this.baseURL}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        await this.handleError(response);
      }

      const data = (await response.json()) as OpenAIChatCompletionResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new ModelResponseError("openai", "No choices returned");
      }

      const choice = data.choices[0];

      return {
        content: choice.message.content,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        model: data.model,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      if (error instanceof ModelError) {
        throw error;
      }
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw new ModelTimeoutError("openai", this.timeout);
      }
      if (error instanceof TypeError) {
        // fetch network errors
        throw new ModelTimeoutError("openai", this.timeout);
      }
      throw new ModelError(
        error instanceof Error ? error.message : String(error),
        "openai",
        error instanceof Error ? error : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleError(response: Response): Promise<never> {
    const status = response.status;

    if (status === 401) {
      throw new ModelAuthenticationError("openai");
    }

    if (status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
      throw new ModelRateLimitError(
        "openai",
        Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
      );
    }

    if (status === 404) {
      throw new ModelNotFoundError("openai", this.modelId);
    }

    if (status === 408) {
      throw new ModelTimeoutError("openai", this.timeout);
    }

    let detail: string;
    try {
      const body = (await response.json()) as { error?: { message?: string } } | undefined;
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text().catch(() => "");
    }

    throw new ModelError(
      `OpenAI API error ${status}: ${detail}`.trim(),
      "openai",
    );
  }
}

// ---------------------------------------------------------------------------
// OpenAI Provider
// ---------------------------------------------------------------------------

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai";

  private readonly config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  createModel(_config?: ModelConfig): LanguageModel {
    return new OpenAILanguageModel(_config ?? this.config);
  }

  validate(): void {
    if (!this.config.apiKey || this.config.apiKey.trim() === "") {
      throw new ModelAuthenticationError(
        "openai",
        "API key is required. Set OPENAI_API_KEY environment variable.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function openai(config?: Partial<ModelConfig> & { apiKey?: string }): OpenAIProvider {
  const resolvedConfig: ModelConfig = {
    apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? "",
    model: config?.model ?? "gpt-4o",
    baseURL: config?.baseURL,
    temperature: config?.temperature,
    maxTokens: config?.maxTokens,
    timeout: config?.timeout,
  };

  return new OpenAIProvider(resolvedConfig);
}
