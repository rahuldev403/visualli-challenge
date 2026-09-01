import { Request, Response, NextFunction } from "express";
import { GeminiService } from "../ai/gemini.service";
import { MindmapRepository } from "../db/mindmap.repository";

export class MindmapController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;

      if (!text || typeof text !== "string" || text.trim().length < 20) {
        return res
          .status(400)
          .json({ error: "Please provide at least 20 characters of text." });
      }

      const aiData = await GeminiService.generateMindmap(text);

      const savedRecord = MindmapRepository.create(aiData);

      res.status(201).json(savedRecord);
    } catch (error) {
      next(error); 
    }
  }

  static async getAll(req: Request, res: Response) {
    const records = MindmapRepository.findAll();
    res.json(records);
  }

  static async getById(req: Request, res: Response) {
    const record = MindmapRepository.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Mindmap not found" });
    }
    res.json(record);
  }
}
