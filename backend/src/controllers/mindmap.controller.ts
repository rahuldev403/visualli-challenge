import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../ai/errors";
import { expandNode, generateMindmap, type ProgressEvent } from "../ai/generator";
import { MindmapRepository, toPublicMindmap } from "../db/mindmap.repository";
import { toErrorPayload } from "../middleware/errorHandler";
import { CreateMindmapRequestSchema, ExpandNodeRequestSchema } from "../shared/types";

export class MindmapController {
  /** POST /api/mindmaps — blocking create. */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text } = CreateMindmapRequestSchema.parse(req.body);
      const mindmap = await generateMindmap(text);
      const record = MindmapRepository.create(mindmap, text);
      res.status(201).json(toPublicMindmap(record));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/mindmaps/stream — the same create flow over Server-Sent Events.
   *
   * Two-phase generation is what makes this worth streaming: the outline lands
   * well before the summaries do, so the client can draw a real skeleton graph
   * instead of animating a spinner.
   */
  static async createStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = CreateMindmapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const { status, body } = toErrorPayload(parsed.error);
      res.status(status).json(body);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tells nginx and friends not to buffer the stream into uselessness.
      "X-Accel-Buffering": "no",
    });

    let clientGone = false;
    req.on("close", () => {
      clientGone = true;
    });

    const send = (event: string, data: unknown): void => {
      if (clientGone) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const onProgress = (event: ProgressEvent) => send("progress", event);
      const mindmap = await generateMindmap(parsed.data.text, { onProgress });
      const record = MindmapRepository.create(mindmap, parsed.data.text);
      send("result", toPublicMindmap(record));
    } catch (error) {
      // The status line is long gone by now, so failures are reported as a
      // terminal SSE event rather than an HTTP status.
      if (!clientGone) {
        const { body } = toErrorPayload(error);
        if (body.code === "INTERNAL_ERROR") console.error("Stream failed:", error);
        send("error", body);
      } else {
        next(error);
        return;
      }
    } finally {
      if (!clientGone) res.end();
    }
  }

  /** GET /api/mindmaps — id, title and createdAt only. */
  static getAll(_req: Request, res: Response, next: NextFunction): void {
    try {
      res.json(MindmapRepository.findAll());
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/mindmaps/:id */
  static getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const record = MindmapRepository.findById(req.params.id as string);
      if (!record) throw new NotFoundError(`No mindmap found with id "${req.params.id}"`);
      res.json(toPublicMindmap(record));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/mindmaps/:id/expand — drill one level deeper into a single node.
   * Returns the whole updated mindmap so the client re-renders from one source
   * of truth rather than merging graph state itself.
   */
  static async expand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nodeId } = ExpandNodeRequestSchema.parse(req.body);
      const record = MindmapRepository.findById(req.params.id as string);
      if (!record) throw new NotFoundError(`No mindmap found with id "${req.params.id}"`);

      const expansion = await expandNode({
        mindmap: record,
        nodeId,
        sourceText: record.sourceText,
      });

      const updated = MindmapRepository.appendExpansion(record.id, nodeId, expansion);
      if (!updated) throw new NotFoundError(`No mindmap found with id "${req.params.id}"`);

      res.status(201).json(toPublicMindmap(updated));
    } catch (error) {
      next(error);
    }
  }
}
