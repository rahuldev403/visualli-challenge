import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { generateMindmap } from "./generator";
import { Mindmap } from "../../../packages/shared/types";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// Persistence (In-memory DB)
const db = new Map<string, Mindmap & { id: string; createdAt: string }>();

// Routes
app.post(
  "/api/mindmaps",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res
          .status(400)
          .json({ error: "Missing or invalid 'text' in request body." });
      }

      const mindmapData = await generateMindmap(text);

      const id = uuidv4();
      const record = {
        ...mindmapData,
        id,
        createdAt: new Date().toISOString(),
      };
      db.set(id, record);

      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/mindmaps", (req: Request, res: Response) => {
  const list = Array.from(db.values()).map(({ id, title, createdAt }) => ({
    id,
    title,
    createdAt,
  }));
  res.json(list);
});

app.get("/api/mindmaps/:id", (req: Request, res: Response) => {
  const record = db.get(req.params.id);
  if (!record) return res.status(404).json({ error: "Mindmap not found" });
  res.json(record);
});

// Centralized Error Handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(3001, () => console.log("Backend running on port 3001"));
