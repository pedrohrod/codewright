import type { LanguageModel } from "./language-model.js";

/**
 * Common configuration for all model providers.
 */
export interface ModelConfig {
  /** API key (from environment variable) */
  apiKey: string;
  /** Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514") */
  model: string;
  /** Base URL override (for compatible providers) */
  baseURL?: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Model provider contract.
 * Implement this to integrate with any LLM API.
 */
export interface ModelProvider {
  readonly name: string;

  /** Create a language model instance */
  createModel(config: ModelConfig): LanguageModel;

  /** Validate that the provider has required credentials */
  validate(): void;
}

/**
 * Model provider factory function.
 */
export type ModelProviderFactory = (config: ModelConfig) => ModelProvider;
