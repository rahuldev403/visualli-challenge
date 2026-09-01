import type { Edge, Node } from "reactflow";
import type { Mindmap } from "../types";
import type { MindmapNodeData } from "../components/MindmapNode";

/** Distance from the root to the first ring of children. */
const RING_RADIUS = 300;
/** Distance from a parent to its drilled-down children. */
const CHILD_RADIUS = 210;
/** How wide a fan of children spreads, in radians. */
const CHILD_SPREAD = Math.PI * 0.7;
/** Each level further out is drawn slightly tighter. */
const DEPTH_FALLOFF = 0.82;

export interface Placement {
  x: number;
  y: number;
  depth: number;
  /** Outward bearing from the centre, used to fan this node's own children. */
  angle: number;
}

/**
 * Assigns every node a position.
 *
 * The root anchors the centre, its children ring it, and anything deeper —
 * which in practice means a drill-down layer — fans outward from its own
 * parent rather than rejoining the main ring. That keeps an expansion visually
 * attached to the node it came from.
 *
 * Layout is derived from the connection graph rather than node order, so it
 * stays stable as expansions are merged in.
 */
export function computePlacements(mindmap: Mindmap): Map<string, Placement> {
  const { rootId, nodes, connections } = mindmap;
  const known = new Set(nodes.map((n) => n.id));
  const placements = new Map<string, Placement>();

  if (!known.has(rootId)) return placements;

  // Breadth-first over the undirected graph: a connection may be authored in
  // either direction, and what matters here is distance from the root.
  const childrenOf = new Map<string, string[]>();
  const depthOf = new Map<string, number>([[rootId, 0]]);
  const seen = new Set<string>([rootId]);
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const current = queue.shift() as string;

    for (const connection of connections) {
      let neighbour: string | undefined;
      if (connection.from === current) neighbour = connection.to;
      else if (connection.to === current) neighbour = connection.from;
      if (!neighbour || seen.has(neighbour) || !known.has(neighbour)) continue;

      seen.add(neighbour);
      depthOf.set(neighbour, (depthOf.get(current) as number) + 1);
      childrenOf.set(current, [...(childrenOf.get(current) ?? []), neighbour]);
      queue.push(neighbour);
    }
  }

  placements.set(rootId, { x: 0, y: 0, depth: 0, angle: 0 });

  // Anything the root cannot reach still has to be visible, so it joins the
  // first ring rather than being silently dropped at the origin.
  const unreachable = nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
  const firstRing = [...(childrenOf.get(rootId) ?? []), ...unreachable];

  firstRing.forEach((id, index) => {
    const angle = (index / firstRing.length) * 2 * Math.PI - Math.PI / 2;
    placements.set(id, {
      x: Math.cos(angle) * RING_RADIUS,
      y: Math.sin(angle) * RING_RADIUS,
      depth: 1,
      angle,
    });
  });

  const frontier = [...firstRing];
  while (frontier.length > 0) {
    const parentId = frontier.shift() as string;
    const children = childrenOf.get(parentId) ?? [];
    const parent = placements.get(parentId);
    if (children.length === 0 || !parent) continue;

    const radius = CHILD_RADIUS * DEPTH_FALLOFF ** (parent.depth - 1);

    children.forEach((id, index) => {
      // A lone child continues straight out; siblings fan around that bearing.
      const offset =
        children.length === 1 ? 0 : (index / (children.length - 1) - 0.5) * CHILD_SPREAD;
      const angle = parent.angle + offset;

      placements.set(id, {
        x: parent.x + Math.cos(angle) * radius,
        y: parent.y + Math.sin(angle) * radius,
        depth: parent.depth + 1,
        angle,
      });
      frontier.push(id);
    });
  }

  return placements;
}

export interface GraphElements {
  nodes: Node<MindmapNodeData>[];
  edges: Edge[];
}

/** Turns a validated mindmap into React Flow nodes and labelled edges. */
export function buildGraphElements(
  mindmap: Mindmap,
  selectedNodeId: string | null,
): GraphElements {
  const placements = computePlacements(mindmap);

  const nodes: Node<MindmapNodeData>[] = mindmap.nodes.map((node) => {
    const placement = placements.get(node.id) ?? { x: 0, y: 0, depth: 1, angle: 0 };

    return {
      id: node.id,
      type: "mindmapNode",
      position: { x: placement.x, y: placement.y },
      data: {
        id: node.id,
        label: node.label,
        summary: node.summary,
        depth: placement.depth,
        isRoot: node.id === mindmap.rootId,
        isSelected: node.id === selectedNodeId,
        isExpanded: mindmap.expandedNodeIds.includes(node.id),
      },
    };
  });

  const edges: Edge[] = mindmap.connections.map((connection, index) => ({
    id: `e-${connection.from}-${connection.to}-${index}`,
    source: connection.from,
    target: connection.to,
    label: connection.label.toUpperCase(),
    type: "smoothstep",
    animated: true,
    style: { stroke: "var(--edge)", strokeWidth: 3 },
    labelStyle: {
      fill: "var(--highlight)",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 7,
      fontWeight: "bold",
    },
    labelBgStyle: {
      fill: "var(--surface)",
      fillOpacity: 1,
      stroke: "var(--line)",
      strokeWidth: 2,
    },
    labelBgPadding: [6, 4] as [number, number],
  }));

  return { nodes, edges };
}
