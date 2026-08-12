import type {
  LanguageModel,
  ModelCallOptions,
  ModelResponse,
  ModelUsage,
} from "../language-model.js";
import type { ModelConfig, ModelProvider } from "../model-provider.js";
import {
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelNotFoundError,
  ModelTimeoutError,
  ModelResponseError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Internal types for the Anthropic Messages API wire format
// ---------------------------------------------------------------------------

interface AnthropicRequest {
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  system?: string;
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
}

interface AnthropicContentBlock {
  type: "text";
  text: string;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  usage: AnthropicUsage;
  model: string;
  stop_reason: string | null;
}

interface AnthropicErrorResponse {
  error?: { message?: string; type?: string };
}

// ---------------------------------------------------------------------------
// AnthropicProvider
// ---------------------------------------------------------------------------

const PROVIDER_NAME = "anthropic";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

class AnthropicLanguageModel implements LanguageModel {
  readonly name = PROVIDER_NAME;
  readonly modelId: string;

  private readonly config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.modelId = config.model;
  }

  async generate(options: ModelCallOptions): Promise<ModelResponse> {
    const { messages, temperature, maxTokens, stop } = options;

    // Separate system messages from the rest.
    const systemParts: string[] = [];
    const apiMessages: Array<{ role: "user" | "assistant"; content: string }> =
      [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        apiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: AnthropicRequest = {
      model: this.config.model,
      messages: apiMessages,
      max_tokens: maxTokens ?? this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    if (systemParts.length > 0) {
      body.system = systemParts.join("\n");
    }

    if (temperature !== undefined) {
      body.temperature = temperature;
    } else if (this.config.temperature !== undefined) {
      body.temperature = this.config.temperature;
    }

    if (stop !== undefined && stop.length > 0) {
      body.stop_sequences = stop;
    }

    const baseURL = this.config.baseURL ?? DEFAULT_BASE_URL;
    const url = `${baseURL}/v1/messages`;
    const timeout = this.config.timeout ?? 60_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": this.config.apiKey,
          "anthropic-version": API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      if (
        (err instanceof DOMException || err instanceof Error) &&
        (err as Error).name === "AbortError"
      ) {
        throw new ModelTimeoutError(PROVIDER_NAME, timeout);
      }
      throw err;
    }
    clearTimeout(timer);

    // ----- Error handling ---------------------------------------------------
    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `Anthropic API error (${response.status})`;
      try {
        const parsed: AnthropicErrorResponse = JSON.parse(text);
        if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        }
      } catch {
        // Use default message when body isn't JSON
      }

      switch (response.status) {
        case 401:
          throw new ModelAuthenticationError(PROVIDER_NAME, errorMsg);
        case 429: {
          const retryAfter = response.headers.get("retry-after");
          throw new ModelRateLimitError(
            PROVIDER_NAME,
            retryAfter ? Number(retryAfter) * 1000 : undefined,
          );
        }
        case 404:
          throw new ModelNotFoundError(PROVIDER_NAME, this.config.model);
        default:
          throw new ModelResponseError(PROVIDER_NAME, errorMsg);
      }
    }

    // ----- Successful response ----------------------------------------------
    const data = await response.json() as AnthropicResponse;

    const textContent = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    const usage: ModelUsage = {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    };

    return {
      content: textContent,
      usage,
      model: data.model,
      finishReason: data.stop_reason ?? undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface AnthropicProvider extends ModelProvider {
  readonly name: "anthropic";
  createModel(config: ModelConfig): LanguageModel;
  validate(): void;
}

export function anthropic(config: ModelConfig): AnthropicProvider {
  return {
    name: PROVIDER_NAME as "anthropic",

    createModel(modelConfig?: ModelConfig): LanguageModel {
      // Merge provider-level config with call-level overrides.
      const merged: ModelConfig = {
        ...config,
        ...modelConfig,
      };
      return new AnthropicLanguageModel(merged);
    },

    validate(): void {
      if (!config.apiKey || config.apiKey.trim().length === 0) {
        throw new ModelAuthenticationError(
          PROVIDER_NAME,
          "API key is required — set the ANTHROPIC_API_KEY environment variable",
        );
      }
    },
  };
}
