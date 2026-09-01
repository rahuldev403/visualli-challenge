import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import mindmapRoutes from "./routes/mindmap.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/mindmaps", mindmapRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Server Error:", err.message);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend securely running on http://localhost:${PORT}`);
  console.log(`Using Gemini API`);
});
