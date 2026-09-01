"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MindmapController = void 0;
const errors_1 = require("../ai/errors");
const generator_1 = require("../ai/generator");
const mindmap_repository_1 = require("../db/mindmap.repository");
const errorHandler_1 = require("../middleware/errorHandler");
const types_1 = require("../shared/types");
class MindmapController {
    /** POST /api/mindmaps — blocking create. */
    static async create(req, res, next) {
        try {
            const { text } = types_1.CreateMindmapRequestSchema.parse(req.body);
            const mindmap = await (0, generator_1.generateMindmap)(text);
            const record = mindmap_repository_1.MindmapRepository.create(mindmap, text);
            res.status(201).json((0, mindmap_repository_1.toPublicMindmap)(record));
        }
        catch (error) {
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
    static async createStream(req, res, next) {
        const parsed = types_1.CreateMindmapRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            const { status, body } = (0, errorHandler_1.toErrorPayload)(parsed.error);
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
        // Watch the response, not the request: `req` emits "close" as soon as its
        // body has been consumed, which would look like an instant disconnect.
        let clientGone = false;
        res.on("close", () => {
            if (!res.writableFinished)
                clientGone = true;
        });
        const send = (event, data) => {
            if (clientGone || res.writableEnded)
                return;
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        try {
            const onProgress = (event) => send("progress", event);
            const mindmap = await (0, generator_1.generateMindmap)(parsed.data.text, { onProgress });
            const record = mindmap_repository_1.MindmapRepository.create(mindmap, parsed.data.text);
            send("result", (0, mindmap_repository_1.toPublicMindmap)(record));
        }
        catch (error) {
            // The status line is long gone by now, so failures are reported as a
            // terminal SSE event rather than an HTTP status.
            if (!clientGone) {
                const { body } = (0, errorHandler_1.toErrorPayload)(error);
                if (body.code === "INTERNAL_ERROR")
                    console.error("Stream failed:", error);
                send("error", body);
            }
            else {
                next(error);
                return;
            }
        }
        finally {
            if (!res.writableEnded)
                res.end();
        }
    }
    /** GET /api/mindmaps — id, title and createdAt only. */
    static getAll(_req, res, next) {
        try {
            res.json(mindmap_repository_1.MindmapRepository.findAll());
        }
        catch (error) {
            next(error);
        }
    }
    /** GET /api/mindmaps/:id */
    static getById(req, res, next) {
        try {
            const record = mindmap_repository_1.MindmapRepository.findById(req.params.id);
            if (!record)
                throw new errors_1.NotFoundError(`No mindmap found with id "${req.params.id}"`);
            res.json((0, mindmap_repository_1.toPublicMindmap)(record));
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/mindmaps/:id/expand — drill one level deeper into a single node.
     * Returns the whole updated mindmap so the client re-renders from one source
     * of truth rather than merging graph state itself.
     */
    static async expand(req, res, next) {
        try {
            const { nodeId } = types_1.ExpandNodeRequestSchema.parse(req.body);
            const record = mindmap_repository_1.MindmapRepository.findById(req.params.id);
            if (!record)
                throw new errors_1.NotFoundError(`No mindmap found with id "${req.params.id}"`);
            const expansion = await (0, generator_1.expandNode)({
                mindmap: record,
                nodeId,
                sourceText: record.sourceText,
            });
            const updated = mindmap_repository_1.MindmapRepository.appendExpansion(record.id, nodeId, expansion);
            if (!updated)
                throw new errors_1.NotFoundError(`No mindmap found with id "${req.params.id}"`);
            res.status(201).json((0, mindmap_repository_1.toPublicMindmap)(updated));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MindmapController = MindmapController;
