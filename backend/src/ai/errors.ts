/**
 * Errors the AI layer raises. Each carries the HTTP status the API should
 * surface, so the central error handler never has to guess.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The caller sent something we will not send to a model. */
export class InvalidInputError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "INVALID_INPUT", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

/** The provider itself failed: network, auth, rate limit, safety block. */
export class ProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, "PROVIDER_ERROR", details);
  }
}

/**
 * The model answered, but the answer was not a valid mindmap even after the
 * corrective retry. This is the interesting failure mode: it means the model
 * produced untrusted output twice and our validation caught it both times.
 */
export class SchemaValidationError extends AppError {
  constructor(message: string, readonly attempts: string[]) {
    super(message, 422, "SCHEMA_VALIDATION_FAILED", { attempts });
  }
}
