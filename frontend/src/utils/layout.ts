import { MarkerType, type Edge, type Node } from "reactflow";
import type { Mindmap } from "../types";
import type { MindmapNodeData } from "../components/MindmapNode";

/** Distance from the root to the first ring of children. */
const RING_RADIUS = 340;
/** Distance from a parent to its drilled-down children. */
const CHILD_RADIUS = 250;
/** How wide a fan of children spreads, in radians. */
const CHILD_SPREAD = Math.PI * 0.7;
/** Each level further out is drawn slightly tighter. */
const DEPTH_FALLOFF = 0.82;

/**
 * Placements are logical centres, but React Flow positions a node by its
 * top-left corner. These are the rough half-extents of a node box, used to
 * convert between the two so a node sits centred on its computed point.
 */
const NODE_HALF_WIDTH = 90;
const NODE_HALF_HEIGHT = 26;

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

type Side = "top" | "right" | "bottom" | "left";

/**
 * Picks the pair of handles that face each other.
 *
 * Without this every edge would leave the bottom of one box and enter the top
 * of another, so a connection running left or right has to loop around the
 * outside of both. Choosing the facing sides keeps edges short and readable in
 * a radial layout.
 */
export function handleSidesFor(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { source: Side; target: Side } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  return dy >= 0 ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
}

export interface GraphElements {
  nodes: Node<MindmapNodeData>[];
  edges: Edge[];
}

/** Turns a validated mindmap into React Flow nodes and labelled edges. */
export function buildGraphElements(mindmap: Mindmap): GraphElements {
  const placements = computePlacements(mindmap);
  const fallback: Placement = { x: 0, y: 0, depth: 1, angle: 0 };

  const nodes: Node<MindmapNodeData>[] = mindmap.nodes.map((node) => {
    const placement = placements.get(node.id) ?? fallback;

    return {
      id: node.id,
      type: "mindmapNode",
      position: {
        x: placement.x - NODE_HALF_WIDTH,
        y: placement.y - NODE_HALF_HEIGHT,
      },
      data: {
        id: node.id,
        label: node.label,
        summary: node.summary,
        depth: placement.depth,
        isRoot: node.id === mindmap.rootId,
        isExpanded: mindmap.expandedNodeIds.includes(node.id),
      },
    };
  });

  const edges: Edge[] = mindmap.connections.map((connection, index) => {
    const sides = handleSidesFor(
      placements.get(connection.from) ?? fallback,
      placements.get(connection.to) ?? fallback,
    );

    return {
      // Index keeps ids unique when two nodes are connected more than once.
      id: `e-${connection.from}-${connection.to}-${index}`,
      source: connection.from,
      target: connection.to,
      sourceHandle: `s-${sides.source}`,
      targetHandle: `t-${sides.target}`,
      label: connection.label.toUpperCase(),
      // Curved rather than stepped, and static rather than marching dashes:
      // both read far more calmly on a dense graph.
      type: "default",
      animated: false,
      style: { stroke: "var(--edge)", strokeWidth: 2.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--edge)",
        width: 18,
        height: 18,
      },
      labelShowBg: true,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 0,
    };
  });

  return { nodes, edges };
}
