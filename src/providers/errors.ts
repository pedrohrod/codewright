/**
 * Base error for all provider errors.
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Authentication failed (invalid key, token, or expired credentials).
 */
export class ProviderAuthenticationError extends ProviderError {
  constructor(provider: string, message = "Authentication failed") {
    super(message, provider);
    this.name = "ProviderAuthenticationError";
  }
}

/**
 * Resource not found (ticket, repo, branch, etc.).
 */
export class ProviderNotFoundError extends ProviderError {
  constructor(provider: string, resource: string) {
    super(`${resource} not found`, provider);
    this.name = "ProviderNotFoundError";
  }
}

/**
 * Conflict: resource is in an unexpected state (e.g., already claimed).
 */
export class ProviderConflictError extends ProviderError {
  constructor(provider: string, message: string) {
    super(message, provider);
    this.name = "ProviderConflictError";
  }
}

/**
 * Rate limit exceeded.
 */
export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs?: number;

  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limit exceeded${retryAfterMs ? `, retry after ${retryAfterMs}ms` : ""}`, provider);
    this.name = "ProviderRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}
