import type { Node, Edge } from "reactflow";
import type { CustomNodeData } from "../components/MindmapNodeComponent";

export interface MindmapPayload {
  id: string;
  title: string;
  rootId: string;
  nodes: Array<{ id: string; label: string; summary: string }>;
  connections: Array<{ from: string; to: string; label: string }>;
  createdAt: string;
}

export function buildGraphElements(
  mindmap: MindmapPayload,
  selectedNodeId: string | null,
): { nodes: Node<CustomNodeData>[]; edges: Edge[] } {
  const { rootId, nodes: rawNodes, connections } = mindmap;

  const rootNode = rawNodes.find((n) => n.id === rootId);
  const childNodes = rawNodes.filter((n) => n.id !== rootId);

  const centerX = 400;
  const centerY = 300;
  const radius = 230;

  const flowNodes: Node<CustomNodeData>[] = [];

  if (rootNode) {
    flowNodes.push({
      id: rootNode.id,
      type: "mindmapNode",
      position: { x: centerX - 80, y: centerY - 30 },
      data: {
        id: rootNode.id,
        label: rootNode.label,
        summary: rootNode.summary,
        isRoot: true,
        isSelected: selectedNodeId === rootNode.id,
      },
    });
  }

  const angleStep = (2 * Math.PI) / (childNodes.length || 1);
  childNodes.forEach((node, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle) - 75;
    const y = centerY + radius * Math.sin(angle) - 25;

    flowNodes.push({
      id: node.id,
      type: "mindmapNode",
      position: { x, y },
      data: {
        id: node.id,
        label: node.label,
        summary: node.summary,
        isRoot: false,
        isSelected: selectedNodeId === node.id,
      },
    });
  });

  const flowEdges: Edge[] = connections.map((conn, idx) => ({
    id: `e-${conn.from}-${conn.to}-${idx}`,
    source: conn.from,
    target: conn.to,
    label: conn.label.toUpperCase(),
    type: "step", 
    animated: true,
    style: { stroke: "#00f0ff", strokeWidth: 3 },
    labelStyle: {
      fill: "#ffe600",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 7,
      fontWeight: "bold",
    },
    labelBgStyle: {
      fill: "#0f0f1b",
      fillOpacity: 1,
      stroke: "#000",
      strokeWidth: 2,
      rx: 0,
      ry: 0,
    },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}
