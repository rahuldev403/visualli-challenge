import { z } from "zod";

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

export const MIN_NODES = 5;
export const MAX_NODES = 9;
export const MAX_LABEL_WORDS = 4;

/** Input guards, applied before a single token is spent. */
export const MIN_INPUT_CHARS = 20;
/** ~3k tokens of prose. Anything longer is rejected rather than silently truncated. */
export const MAX_INPUT_CHARS = 12_000;

/** Drill-down expansions add a small layer at a time. */
export const MIN_EXPANSION_NODES = 2;
export const MAX_EXPANSION_NODES = 4;

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export const MindmapNodeSchema = z.object({
  id: z
    .string()
    .min(1, "node id must not be empty")
    .meta({ description: "Stable identifier unique within the mindmap, e.g. n1" }),
  label: z
    .string()
    .min(1, "label must not be empty")
    .meta({ description: "Short title of 1-4 words" })
    .refine((v) => wordCount(v) <= MAX_LABEL_WORDS, {
      message: `label must be at most ${MAX_LABEL_WORDS} words`,
    }),
  summary: z
    .string()
    .min(1, "summary must not be empty")
    .meta({ description: "Exactly one sentence describing this node" }),
});

export const MindmapConnectionSchema = z.object({
  from: z.string().min(1).meta({ description: "id of the origin node" }),
  to: z.string().min(1).meta({ description: "id of the destination node" }),
  label: z
    .string()
    .min(1)
    .meta({ description: 'Relationship label, e.g. "causes" or "part of"' }),
});

/** Structural shape only. Used to derive the schema we send to the model. */
export const MindmapShapeSchema = z.object({
  title: z.string().min(1).meta({ description: "Title of the whole mindmap" }),
  rootId: z.string().min(1).meta({ description: "id of the central node" }),
  nodes: z.array(MindmapNodeSchema).min(MIN_NODES).max(MAX_NODES),
  connections: z.array(MindmapConnectionSchema).min(1),
});

/* ------------------------------------------------------------------ *
 * Semantic checks. Every one of these has been observed to fail in the
 * wild, which is exactly why they are enforced in code and not in the
 * prompt.
 * ------------------------------------------------------------------ */

const uniqueIds = <T extends { nodes: { id: string }[] }>(data: T) =>
  new Set(data.nodes.map((n) => n.id)).size === data.nodes.length;

const rootExists = <T extends { rootId: string; nodes: { id: string }[] }>(data: T) =>
  data.nodes.some((n) => n.id === data.rootId);

const noDanglingEdges = <
  T extends { nodes: { id: string }[]; connections: { from: string; to: string }[] },
>(
  data: T,
) => {
  const ids = new Set(data.nodes.map((n) => n.id));
  return data.connections.every((c) => ids.has(c.from) && ids.has(c.to));
};

const noSelfLoops = <T extends { connections: { from: string; to: string }[] }>(data: T) =>
  data.connections.every((c) => c.from !== c.to);

export const MindmapSchema = MindmapShapeSchema.refine(uniqueIds, {
  message: "node ids must be unique",
})
  .refine(rootExists, { message: "rootId must match the id of a real node" })
  .refine(noDanglingEdges, {
    message: "every connection must reference an existing node id",
  })
  .refine(noSelfLoops, { message: "a connection must not point at its own node" });

export type MindmapNode = z.infer<typeof MindmapNodeSchema>;
export type MindmapConnection = z.infer<typeof MindmapConnectionSchema>;
export type Mindmap = z.infer<typeof MindmapShapeSchema>;

/* ------------------------------------------------------------------ *
 * Two-phase generation schemas
 * ------------------------------------------------------------------ */

/** Phase 1: cheap outline. Labels only, no prose. */
export const OutlineSchema = z
  .object({
    title: z.string().min(1).meta({ description: "Title of the whole mindmap" }),
    rootId: z.string().min(1).meta({ description: "id of the central node" }),
    nodes: z
      .array(
        z.object({
          id: MindmapNodeSchema.shape.id,
          label: MindmapNodeSchema.shape.label,
        }),
      )
      .min(MIN_NODES)
      .max(MAX_NODES),
  })
  .refine(uniqueIds, { message: "node ids must be unique" })
  .refine(rootExists, { message: "rootId must match the id of a real node" });

export type Outline = z.infer<typeof OutlineSchema>;

/** Phase 2: summaries + relationships over the ids fixed by phase 1. */
export const DetailSchema = z.object({
  summaries: z
    .array(
      z.object({
        id: z.string().min(1).meta({ description: "id of an existing outline node" }),
        summary: MindmapNodeSchema.shape.summary,
      }),
    )
    .min(MIN_NODES)
    .max(MAX_NODES),
  connections: z.array(MindmapConnectionSchema).min(1),
});

export type Detail = z.infer<typeof DetailSchema>;

/* ------------------------------------------------------------------ *
 * Drill-down expansion
 * ------------------------------------------------------------------ */

export const ExpansionSchema = z.object({
  nodes: z.array(MindmapNodeSchema).min(MIN_EXPANSION_NODES).max(MAX_EXPANSION_NODES),
  connections: z.array(MindmapConnectionSchema).min(1),
});

export type Expansion = z.infer<typeof ExpansionSchema>;

/* ------------------------------------------------------------------ *
 * Stored records
 *
 * A stored mindmap starts life as a validated 5-9 node Mindmap, but grows
 * past MAX_NODES as the user drills down. It therefore keeps every
 * structural guarantee except the node-count ceiling.
 * ------------------------------------------------------------------ */

export const StoredMindmapSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    title: z.string().min(1),
    rootId: z.string().min(1),
    nodes: z.array(MindmapNodeSchema).min(MIN_NODES),
    connections: z.array(MindmapConnectionSchema),
    expandedNodeIds: z.array(z.string()),
  })
  .refine(uniqueIds, { message: "node ids must be unique" })
  .refine(rootExists, { message: "rootId must match the id of a real node" })
  .refine(noDanglingEdges, {
    message: "every connection must reference an existing node id",
  });

export type StoredMindmap = z.infer<typeof StoredMindmapSchema>;

export type MindmapSummary = Pick<StoredMindmap, "id" | "title" | "createdAt">;

/* ------------------------------------------------------------------ *
 * API request schemas
 * ------------------------------------------------------------------ */

export const CreateMindmapRequestSchema = z.object({
  text: z
    .string({ error: "text is required and must be a string" })
    .trim()
    .min(MIN_INPUT_CHARS, `text must be at least ${MIN_INPUT_CHARS} characters to summarise`)
    .max(
      MAX_INPUT_CHARS,
      `text must be at most ${MAX_INPUT_CHARS} characters; please trim the input`,
    ),
});

export const ExpandNodeRequestSchema = z.object({
  nodeId: z.string({ error: "nodeId is required and must be a string" }).min(1, "nodeId is required"),
});
