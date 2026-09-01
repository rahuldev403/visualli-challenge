import { z } from "zod";

export const MindmapNodeSchema = z.object({
  id: z.string(),
  label: z.string().max(40),
  summary: z.string(),
});

export const MindmapConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
});

export const MindmapSchema = z
  .object({
    title: z.string(),
    rootId: z.string(),
    nodes: z.array(MindmapNodeSchema).min(5).max(9),
    connections: z.array(MindmapConnectionSchema),
  })
  .refine((data) => data.nodes.some((n) => n.id === data.rootId), {
    message: "rootId must match an existing node id",
  })
  .refine(
    (data) => {
      const nodeIds = new Set(data.nodes.map((n) => n.id));
      return data.connections.every(
        (c) => nodeIds.has(c.from) && nodeIds.has(c.to),
      );
    },
    {
      message: "All connections must reference valid node ids",
    },
  );

export type Mindmap = z.infer<typeof MindmapSchema>;
