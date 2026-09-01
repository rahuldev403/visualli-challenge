import express from "express";
import cors from "cors";
import mindmapRoutes from "./routes/mindmap.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { isMockMode } from "./ai/provider";

export function createApp() {
  const app = express();

  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ?? "http://localhost:5173"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) =>
        !origin || allowedOrigins.includes(origin)
          ? callback(null, true)
          : callback(new Error("Not allowed by CORS")),
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
