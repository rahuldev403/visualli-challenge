import React, { useState, useMemo, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";

import MindmapNodeComponent, {
  type CustomNodeData,
} from "./components/MindmapNodeComponent";
import { buildGraphElements, type MindmapPayload } from "./utils/layout";

const nodeTypes = { mindmapNode: MindmapNodeComponent };

export default function App() {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeMindmap, setActiveMindmap] = useState<MindmapPayload | null>(
    null,
  );
  const [selectedNode, setSelectedNode] = useState<{
    label: string;
    summary: string;
  } | null>(null);

  const selectedNodeId = selectedNode
    ? (activeMindmap?.nodes.find((n) => n.label === selectedNode.label)?.id ??
      null)
    : null;

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!activeMindmap) return { nodes: [], edges: [] };
    return buildGraphElements(activeMindmap, selectedNodeId);
  }, [activeMindmap, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    if (activeMindmap) {
      const { nodes: updatedNodes, edges: updatedEdges } = buildGraphElements(
        activeMindmap,
        selectedNodeId,
      );
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    }
  }, [activeMindmap, selectedNodeId, setNodes, setEdges]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim().length < 20) {
      setErrorMessage("ERR: INPUT MUST BE >= 20 CHARS");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSelectedNode(null);

    try {
      const response = await fetch("http://localhost:3001/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "EXECUTION FAILED");

      setActiveMindmap(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message || "NET ERROR");
      } else {
        setErrorMessage("NET ERROR");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<CustomNodeData>) => {
      setSelectedNode({
        label: node.data.label,
        summary: node.data.summary,
      });
    },
    [],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f1b] font-terminal text-[#e0e0ff] relative scanlines">
      {/* Sidebar / Retro Terminal Container */}
      <aside className="w-[380px] bg-[#1a1b35] border-r-4 border-black p-5 flex flex-col justify-between z-20 shadow-[6px_0px_0px_#000]">
        <div className="flex flex-col gap-4">
          {/* Retro Window Header */}
          <div className="bg-[#ff2a85] text-black px-3 py-1.5 border-2 border-black flex justify-between items-center shadow-[3px_3px_0px_#000]">
            <span className="font-pixel text-[10px] tracking-widest font-bold">
              MINDMAP.EXE
            </span>
            <div className="flex gap-1 text-[9px] font-pixel font-bold">
              <span className="bg-black text-[#ff2a85] px-1">[?]</span>
              <span className="bg-black text-[#ff2a85] px-1">[X]</span>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <label className="text-sm font-pixel text-[#00f0ff] flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-[#00f0ff] animate-pulse" />
              INPUT RAW DATA:
            </label>
            <textarea
              rows={6}
              className="w-full text-base p-3 bg-[#0d0e1a] text-[#39ff14] border-2 border-black focus:outline-none focus:border-[#00f0ff] resize-none font-terminal leading-relaxed"
              placeholder="PASTE PROSE / DATA HERE..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || inputText.trim().length < 20}
              className="pixel-btn w-full py-2 bg-[#ffe600] disabled:bg-[#4a4b63] disabled:text-[#8d8ea6] text-black font-pixel text-xs font-bold uppercase tracking-wider"
            >
              {isLoading ? ">>> PROCESSING..." : "► COMPILE MAP"}
            </button>
          </form>

          {errorMessage && (
            <div className="p-2 text-xs font-pixel bg-[#ff0055] text-white border-2 border-black shadow-[3px_3px_0px_#000]">
              {errorMessage}
            </div>
          )}

          {/* Node Summary Terminal Window */}
          {selectedNode && (
            <div className="p-3 bg-[#0a0a14] border-2 border-[#00f0ff] shadow-[4px_4px_0px_#00f0ff] mt-2">
              <div className="text-[9px] font-pixel text-[#ffe600] uppercase mb-1 border-b border-[#00f0ff]/40 pb-1">
                NODE_INFO: {selectedNode.label}
              </div>
              <p className="text-base text-[#e0e0ff] leading-tight font-terminal">
                {selectedNode.summary}
              </p>
            </div>
          )}
        </div>

        {activeMindmap && (
          <div className="text-sm text-[#00f0ff] border-t-2 border-black pt-2 font-pixel text-[9px] truncate">
            MAP: <span className="text-[#ffe600]">{activeMindmap.title}</span>
          </div>
        )}
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative h-full bg-[#090a12]">
        {!activeMindmap ? (
          <div className="h-full flex flex-col items-center justify-center text-[#595a75] text-center">
            <div className="text-5xl font-pixel mb-4 text-[#ff2a85] animate-bounce">
              👾
            </div>
            <p className="font-pixel text-xs text-[#00f0ff] tracking-widest uppercase">
              NO MAP COMPILED YET
            </p>
            <p className="font-terminal text-lg text-[#8d8ea6] mt-1">
              INPUT SOURCE TEXT IN TERMINAL TO RUN VISUALIZER
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            {/* Retro 8-bit Dot Grid Background */}
            <Background color="#3d1a75" gap={20} size={2} />
            <Controls className="!bg-[#1a1b35] !border-2 !border-black !shadow-[4px_4px_0px_#000] !rounded-none [&>button]:!border-b-2 [&>button]:!border-black [&>button]:!fill-[#00f0ff]" />
          </ReactFlow>
        )}
      </main>
    </div>
  );
}
