import { useState } from "react";
import ReactFlow, { Background, Controls, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { Mindmap, MindmapNode } from "../../packages/shared/types";

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setSelectedNode(null);
    try {
      const res = await fetch("http://localhost:3001/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMindmap(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert schema data to ReactFlow layout
  const getGraphElements = () => {
    if (!mindmap) return { nodes: [], edges: [] };

    const radius = 250;
    const children = mindmap.nodes.filter((n) => n.id !== mindmap.rootId);
    const angleStep = (2 * Math.PI) / children.length;

    const rootNode = mindmap.nodes.find((n) => n.id === mindmap.rootId)!;

    const nodes: Node[] = [
      {
        id: rootNode.id,
        position: {
          x: window.innerWidth / 2 - 100,
          y: window.innerHeight / 2 - 100,
        },
        data: { label: rootNode.label, fullData: rootNode },
        style: { background: "#2563eb", color: "white", fontWeight: "bold" },
      },
    ];

    children.forEach((node, i) => {
      nodes.push({
        id: node.id,
        position: {
          x: window.innerWidth / 2 - 100 + Math.cos(i * angleStep) * radius,
          y: window.innerHeight / 2 - 100 + Math.sin(i * angleStep) * radius,
        },
        data: { label: node.label, fullData: node },
      });
    });

    const edges: Edge[] = mindmap.connections.map((conn, i) => ({
      id: `e-${i}`,
      source: conn.from,
      target: conn.to,
      label: conn.label,
      animated: true,
    }));

    return { nodes, edges };
  };

  const { nodes, edges } = getGraphElements();

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans">
      {/* Sidebar Input & Selection Panel */}
      <div className="w-80 p-6 bg-white border-r flex flex-col gap-4 shadow-sm z-10">
        <h1 className="text-xl font-bold">Visualli Minis</h1>
        <textarea
          className="w-full h-48 p-3 border rounded text-sm resize-none"
          placeholder="Paste article, notes, or prose here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || text.length < 20}
          className="w-full py-2 bg-blue-600 text-white rounded font-medium disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Diagram"}
        </button>

        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

        {/* Node Summary Reveal */}
        {selectedNode && (
          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-2">
              {selectedNode.label}
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              {selectedNode.summary}
            </p>
          </div>
        )}
      </div>

      {/* Diagram Area */}
      <div className="flex-1 relative">
        {!mindmap ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            {loading
              ? "Analyzing text and building mindmap..."
              : "Provide text to generate a mindmap"}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => setSelectedNode(node.data.fullData)}
            fitView
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
