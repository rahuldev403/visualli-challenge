"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidationError = exports.ProviderError = exports.NotFoundError = exports.InvalidInputError = exports.AppError = void 0;
/**
 * Errors the AI layer raises. Each carries the HTTP status the API should
 * surface, so the central error handler never has to guess.
 */
class AppError extends Error {
    status;
    code;
    details;
    constructor(message, status, code, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = new.target.name;
    }
}
exports.AppError = AppError;
/** The caller sent something we will not send to a model. */
class InvalidInputError extends AppError {
    constructor(message, details) {
        super(message, 400, "INVALID_INPUT", details);
    }
}
exports.InvalidInputError = InvalidInputError;
class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, "NOT_FOUND");
    }
}
exports.NotFoundError = NotFoundError;
/** The provider itself failed: network, auth, rate limit, safety block. */
class ProviderError extends AppError {
    constructor(message, details) {
        super(message, 502, "PROVIDER_ERROR", details);
    }
}
exports.ProviderError = ProviderError;
/**
 * The model answered, but the answer was not a valid mindmap even after the
 * corrective retry. This is the interesting failure mode: it means the model
 * produced untrusted output twice and our validation caught it both times.
 */
class SchemaValidationError extends AppError {
    attempts;
    constructor(message, attempts) {
        super(message, 422, "SCHEMA_VALIDATION_FAILED", { attempts });
        this.attempts = attempts;
    }
}
exports.SchemaValidationError = SchemaValidationError;
