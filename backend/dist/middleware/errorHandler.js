"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toErrorPayload = toErrorPayload;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const zod_1 = require("zod");
const errors_1 = require("../ai/errors");
function toErrorPayload(error) {
    if (error instanceof zod_1.ZodError) {
        return {
            status: 400,
            body: {
                error: "Request body failed validation",
                code: "INVALID_REQUEST",
                details: error.issues.map((issue) => ({
                    path: issue.path.join(".") || "body",
                    message: issue.message,
                })),
            },
        };
    }
    if (error instanceof errors_1.AppError) {
        return {
            status: error.status,
            body: { error: error.message, code: error.code },
        };
    }
    return {
        status: 500,
        body: { error: "Something went wrong generating the mindmap.", code: "INTERNAL_ERROR" },
    };
}
function errorHandler(error, _req, res, next) {
    // A streaming response has already committed its status line; let Express
    // tear the socket down rather than trying to write a JSON body over SSE.
    if (res.headersSent) {
        next(error);
        return;
    }
    const { status, body } = toErrorPayload(error);
    if (status >= 500) {
        console.error("Unhandled error:", error);
    }
    else if (process.env.NODE_ENV !== "test") {
        console.warn(`${status} ${body.code}: ${body.error}`);
    }
    res.status(status).json(body);
}
function notFoundHandler(_req, res) {
    res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
}
