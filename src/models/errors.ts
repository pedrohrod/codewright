/**
 * Base error for all model provider errors.
 */
export class ModelError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

/**
 * Authentication failed (invalid or missing API key).
 */
export class ModelAuthenticationError extends ModelError {
  constructor(provider: string, message = "Authentication failed — check your API key") {
    super(message, provider);
    this.name = "ModelAuthenticationError";
  }
}

/**
 * Rate limit exceeded.
 */
export class ModelRateLimitError extends ModelError {
  public readonly retryAfterMs?: number;

  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limit exceeded${retryAfterMs ? `, retry after ${retryAfterMs}ms` : ""}`, provider);
    this.name = "ModelRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Model not found or unavailable.
 */
export class ModelNotFoundError extends ModelError {
  constructor(provider: string, model: string) {
    super(`Model "${model}" not found or unavailable`, provider);
    this.name = "ModelNotFoundError";
  }
}

/**
 * Request timed out.
 */
export class ModelTimeoutError extends ModelError {
  constructor(provider: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, provider);
    this.name = "ModelTimeoutError";
  }
}

/**
 * Context length exceeded.
 */
export class ModelContextLengthError extends ModelError {
  constructor(provider: string, message = "Context length exceeded") {
    super(message, provider);
    this.name = "ModelContextLengthError";
  }
}

/**
 * Invalid response from the model.
 */
export class ModelResponseError extends ModelError {
  constructor(provider: string, message: string) {
    super(`Invalid model response: ${message}`, provider);
    this.name = "ModelResponseError";
  }
}
