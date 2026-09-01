import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../ai/errors";

export interface ErrorPayload {
  error: string;
  code: string;
  details?: unknown;
}


export function toErrorPayload(error: unknown): { status: number; body: ErrorPayload } {
  if (error instanceof ZodError) {
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

  if (error instanceof AppError) {
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

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // A streaming response has already committed its status line; let Express
  // tear the socket down rather than trying to write a JSON body over SSE.
  if (res.headersSent) {
    next(error);
    return;
  }

  const { status, body } = toErrorPayload(error);

  if (status >= 500) {
    console.error("Unhandled error:", error);
  } else if (process.env.NODE_ENV !== "test") {
    console.warn(`${status} ${body.code}: ${body.error}`);
  }

  res.status(status).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found", code: "NOT_FOUND" });
}
