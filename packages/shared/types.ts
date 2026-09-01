import { z } from 'zod';

export const MindmapNodeSchema = z.object({
  id: z.string().describe("Stable and unique identifier"),
  label: z.string().max(30).describe("1-4 words max"),
  summary: z.string().describe("One sentence summary of the node"),
});

export const MindmapConnectionSchema = z.object({
  from: z.string().describe("ID of the origin node"),
  to: z.string().describe("ID of the destination node"),
  label: z.string().describe("Relationship label (e.g., 'causes', 'part of')"),
});

export const MindmapSchema = z.object({
  title: z.string(),
  rootId: z.string().describe("Must match exactly one node's id"),
  nodes: z.array(MindmapNodeSchema)
    .min(5, "Must have at least 5 nodes")
    .max(9, "Must have at most 9 nodes"),
  connections: z.array(MindmapConnectionSchema),
})
// Strict cross-field validations backstop the LLM
.refine((data) => data.nodes.some((n) => n.id === data.rootId), {
  message: "rootId must match an existing node id in the nodes array",
})
.refine((data) => {
  const nodeIds = new Set(data.nodes.map((n) => n.id));
  return data.connections.every((c) => nodeIds.has(c.from) && nodeIds.has(c.to));
}, {
  message: "Connections must reference valid and existing node ids",
});

export type Mindmap = z.infer<typeof MindmapSchema>;
export type MindmapNode = z.infer<typeof MindmapNodeSchema>;
export type MindmapConnection = z.infer<typeof MindmapConnectionSchema>;