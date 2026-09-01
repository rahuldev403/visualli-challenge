import { Mindmap } from "../shared/types";
import { randomUUID } from "crypto";

// In-memory store
type MindmapRecord = Mindmap & { id: string; createdAt: string };
const db = new Map<string, MindmapRecord>();

export class MindmapRepository {
  static create(data: Mindmap): MindmapRecord {
    const id = randomUUID();
    const record: MindmapRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    db.set(id, record);
    return record;
  }

  static findAll() {
    return Array.from(db.values()).map(({ id, title, createdAt }) => ({
      id,
      title,
      createdAt,
    }));
  }

  static findById(id: string): MindmapRecord | undefined {
    return db.get(id);
  }
}
