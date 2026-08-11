/**
 * Normalized message format for all model providers.
 */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Usage statistics from a model call.
 */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Response from a language model.
 */
export interface ModelResponse {
  content: string;
  usage: ModelUsage;
  model: string;
  finishReason?: string;
}

/**
 * Options for a single model call.
 */
export interface ModelCallOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  /** Request JSON output (provider-specific implementation) */
  jsonMode?: boolean;
}

/**
 * A language model that can generate text.
 */
export interface LanguageModel {
  readonly name: string;
  readonly modelId: string;

  /** Generate a completion */
  generate(options: ModelCallOptions): Promise<ModelResponse>;
}
