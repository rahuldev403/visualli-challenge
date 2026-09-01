import express from "express";
import cors from "cors";
import mindmapRoutes from "./routes/mindmap.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { isMockMode } from "./ai/provider";

export function createApp() {
  const app = express();

  // Comma-separated allowlist. Left unset, every origin is allowed — a
  // misconfigured env var must not be able to take the API down.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        // No allowlist configured: allow all.
        if (allowedOrigins.length === 0) return callback(null, true);
        // Non-browser callers (curl, uptime checks) send no Origin header.
        if (!origin) return callback(null, true);
        // Deny by omitting the header, never by throwing: an origin that is
        // not on the list is a policy decision, not a server error, and
        // throwing here produces a 500 with no CORS headers at all.
        return callback(null, allowedOrigins.includes(origin.replace(/\/$/, "")));
      },
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", mockMode: isMockMode() });
  });

  app.use("/api/mindmaps", mindmapRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
