"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpandNodeRequestSchema = exports.CreateMindmapRequestSchema = exports.StoredMindmapSchema = exports.ExpansionSchema = exports.DetailSchema = exports.OutlineSchema = exports.MindmapSchema = exports.MindmapShapeSchema = exports.MindmapConnectionSchema = exports.MindmapNodeSchema = exports.MAX_EXPANSION_NODES = exports.MIN_EXPANSION_NODES = exports.MAX_INPUT_CHARS = exports.MIN_INPUT_CHARS = exports.MAX_LABEL_WORDS = exports.MAX_NODES = exports.MIN_NODES = void 0;
const zod_1 = require("zod");
/**
 * The single strict contract shared by the AI layer, the API layer and the UI.
 *
 * These schemas do double duty:
 *   - `z.toJSONSchema` derives the structured-output schema handed to the LLM
 *   - the same schemas validate whatever actually comes back
 *
 * so the shape we ask for and the shape we enforce can never drift apart.
 * Note that `.refine` checks are intentionally dropped by `toJSONSchema`:
 * they are our backstop, not part of the model's contract.
 */
exports.MIN_NODES = 5;
exports.MAX_NODES = 9;
exports.MAX_LABEL_WORDS = 4;
/** Input guards, applied before a single token is spent. */
exports.MIN_INPUT_CHARS = 20;
/** ~3k tokens of prose. Anything longer is rejected rather than silently truncated. */
exports.MAX_INPUT_CHARS = 12_000;
/** Drill-down expansions add a small layer at a time. */
exports.MIN_EXPANSION_NODES = 2;
exports.MAX_EXPANSION_NODES = 4;
const wordCount = (value) => value.trim().split(/\s+/).filter(Boolean).length;
exports.MindmapNodeSchema = zod_1.z.object({
    id: zod_1.z
        .string()
        .min(1, "node id must not be empty")
        .meta({ description: "Stable identifier unique within the mindmap, e.g. n1" }),
    label: zod_1.z
        .string()
        .min(1, "label must not be empty")
        .meta({ description: "Short title of 1-4 words" })
        .refine((v) => wordCount(v) <= exports.MAX_LABEL_WORDS, {
        message: `label must be at most ${exports.MAX_LABEL_WORDS} words`,
    }),
    summary: zod_1.z
        .string()
        .min(1, "summary must not be empty")
        .meta({ description: "Exactly one sentence describing this node" }),
});
exports.MindmapConnectionSchema = zod_1.z.object({
    from: zod_1.z.string().min(1).meta({ description: "id of the origin node" }),
    to: zod_1.z.string().min(1).meta({ description: "id of the destination node" }),
    label: zod_1.z
        .string()
        .min(1)
        .meta({ description: 'Relationship label, e.g. "causes" or "part of"' }),
});
/** Structural shape only. Used to derive the schema we send to the model. */
exports.MindmapShapeSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).meta({ description: "Title of the whole mindmap" }),
    rootId: zod_1.z.string().min(1).meta({ description: "id of the central node" }),
    nodes: zod_1.z.array(exports.MindmapNodeSchema).min(exports.MIN_NODES).max(exports.MAX_NODES),
    connections: zod_1.z.array(exports.MindmapConnectionSchema).min(1),
});
/* ------------------------------------------------------------------ *
 * Semantic checks. Every one of these has been observed to fail in the
 * wild, which is exactly why they are enforced in code and not in the
 * prompt.
 * ------------------------------------------------------------------ */
const uniqueIds = (data) => new Set(data.nodes.map((n) => n.id)).size === data.nodes.length;
const rootExists = (data) => data.nodes.some((n) => n.id === data.rootId);
const noDanglingEdges = (data) => {
    const ids = new Set(data.nodes.map((n) => n.id));
    return data.connections.every((c) => ids.has(c.from) && ids.has(c.to));
};
const noSelfLoops = (data) => data.connections.every((c) => c.from !== c.to);
exports.MindmapSchema = exports.MindmapShapeSchema.refine(uniqueIds, {
    message: "node ids must be unique",
})
    .refine(rootExists, { message: "rootId must match the id of a real node" })
    .refine(noDanglingEdges, {
    message: "every connection must reference an existing node id",
})
    .refine(noSelfLoops, { message: "a connection must not point at its own node" });
/* ------------------------------------------------------------------ *
 * Two-phase generation schemas
 * ------------------------------------------------------------------ */
/** Phase 1: cheap outline. Labels only, no prose. */
exports.OutlineSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).meta({ description: "Title of the whole mindmap" }),
    rootId: zod_1.z.string().min(1).meta({ description: "id of the central node" }),
    nodes: zod_1.z
        .array(zod_1.z.object({
        id: exports.MindmapNodeSchema.shape.id,
        label: exports.MindmapNodeSchema.shape.label,
    }))
        .min(exports.MIN_NODES)
        .max(exports.MAX_NODES),
})
    .refine(uniqueIds, { message: "node ids must be unique" })
    .refine(rootExists, { message: "rootId must match the id of a real node" });
/** Phase 2: summaries + relationships over the ids fixed by phase 1. */
exports.DetailSchema = zod_1.z.object({
    summaries: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1).meta({ description: "id of an existing outline node" }),
        summary: exports.MindmapNodeSchema.shape.summary,
    }))
        .min(exports.MIN_NODES)
        .max(exports.MAX_NODES),
    connections: zod_1.z.array(exports.MindmapConnectionSchema).min(1),
});
/* ------------------------------------------------------------------ *
 * Drill-down expansion
 * ------------------------------------------------------------------ */
exports.ExpansionSchema = zod_1.z.object({
    nodes: zod_1.z.array(exports.MindmapNodeSchema).min(exports.MIN_EXPANSION_NODES).max(exports.MAX_EXPANSION_NODES),
    connections: zod_1.z.array(exports.MindmapConnectionSchema).min(1),
});
/* ------------------------------------------------------------------ *
 * Stored records
 *
 * A stored mindmap starts life as a validated 5-9 node Mindmap, but grows
 * past MAX_NODES as the user drills down. It therefore keeps every
 * structural guarantee except the node-count ceiling.
 * ------------------------------------------------------------------ */
exports.StoredMindmapSchema = zod_1.z
    .object({
    id: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    title: zod_1.z.string().min(1),
    rootId: zod_1.z.string().min(1),
    nodes: zod_1.z.array(exports.MindmapNodeSchema).min(exports.MIN_NODES),
    connections: zod_1.z.array(exports.MindmapConnectionSchema),
    expandedNodeIds: zod_1.z.array(zod_1.z.string()),
})
    .refine(uniqueIds, { message: "node ids must be unique" })
    .refine(rootExists, { message: "rootId must match the id of a real node" })
    .refine(noDanglingEdges, {
    message: "every connection must reference an existing node id",
});
/* ------------------------------------------------------------------ *
 * API request schemas
 * ------------------------------------------------------------------ */
exports.CreateMindmapRequestSchema = zod_1.z.object({
    text: zod_1.z
        .string({ error: "text is required and must be a string" })
        .trim()
        .min(exports.MIN_INPUT_CHARS, `text must be at least ${exports.MIN_INPUT_CHARS} characters to summarise`)
        .max(exports.MAX_INPUT_CHARS, `text must be at most ${exports.MAX_INPUT_CHARS} characters; please trim the input`),
});
exports.ExpandNodeRequestSchema = zod_1.z.object({
    nodeId: zod_1.z.string({ error: "nodeId is required and must be a string" }).min(1, "nodeId is required"),
});
