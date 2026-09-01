import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Expansion, Mindmap, MindmapSummary, StoredMindmap } from "../shared/types";

/**
 * A stored mindmap keeps the source text so a later drill-down can be grounded
 * in the original document. It is held back from API responses — the client has
 * no use for it and it would dominate the payload.
 */
export type MindmapRecord = StoredMindmap & { sourceText: string };

const isTestEnv = () => process.env.NODE_ENV === "test";

/**
 * Durable enough for this exercise: an in-memory map that write-throughs to a
 * JSON file, so mindmaps survive a restart and not just a request. Swapping in
 * MongoDB later means reimplementing this one class and nothing else.
 *
 * Persistence is skipped under NODE_ENV=test and when MINDMAP_STORE=memory.
 */
class MindmapStore {
  private records = new Map<string, MindmapRecord>();
  private loaded = false;

  private get filePath(): string | undefined {
    if (isTestEnv() || process.env.MINDMAP_STORE === "memory") return undefined;
    return process.env.DATA_FILE || path.join(process.cwd(), "data", "mindmaps.json");
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;

    const file = this.filePath;
    if (!file || !fs.existsSync(file)) return;

    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(parsed)) return;
      for (const record of parsed as MindmapRecord[]) {
        if (record?.id) this.records.set(record.id, record);
      }
    } catch (error) {
      // A corrupt store must not stop the server from booting.
      console.warn(`Could not read mindmap store at ${file}:`, error);
    }
  }

  private persist(): void {
    const file = this.filePath;
    if (!file) return;

    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify([...this.records.values()], null, 2), "utf8");
    } catch (error) {
      // Losing durability is not worth failing the user's request over.
      console.warn(`Could not write mindmap store at ${file}:`, error);
    }
  }

  create(mindmap: Mindmap, sourceText: string): MindmapRecord {
    this.load();
    const record: MindmapRecord = {
      ...mindmap,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      expandedNodeIds: [],
      sourceText,
    };
    this.records.set(record.id, record);
    this.persist();
    return record;
  }

  findAll(): MindmapSummary[] {
    this.load();
    return [...this.records.values()]
      .map(({ id, title, createdAt }) => ({ id, title, createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findById(id: string): MindmapRecord | undefined {
    this.load();
    return this.records.get(id);
  }

  /**
   * Merge a validated drill-down layer into a stored mindmap.
   *
   * The expansion has already been checked against this graph's id set, so the
   * merge itself only has to record which node was expanded.
   */
  appendExpansion(id: string, nodeId: string, expansion: Expansion): MindmapRecord | undefined {
    this.load();
    const existing = this.records.get(id);
    if (!existing) return undefined;

    const updated: MindmapRecord = {
      ...existing,
      nodes: [...existing.nodes, ...expansion.nodes],
      connections: [...existing.connections, ...expansion.connections],
      expandedNodeIds: existing.expandedNodeIds.includes(nodeId)
        ? existing.expandedNodeIds
        : [...existing.expandedNodeIds, nodeId],
    };

    this.records.set(id, updated);
    this.persist();
    return updated;
  }

  /** Test hook. */
  reset(): void {
    this.records.clear();
    this.loaded = false;
  }
}

export const MindmapRepository = new MindmapStore();

/** Strips internals the client has no use for. */
export const toPublicMindmap = ({ sourceText: _sourceText, ...rest }: MindmapRecord): StoredMindmap =>
  rest;
