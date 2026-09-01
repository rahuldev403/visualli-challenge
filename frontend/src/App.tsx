import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, type Node } from "reactflow";
import "reactflow/dist/style.css";

import MindmapNode, { type MindmapNodeData } from "./components/MindmapNode";
import GeneratorForm from "./components/GeneratorForm";
import ProgressLog from "./components/ProgressLog";
import SummaryPanel from "./components/SummaryPanel";
import HistoryList from "./components/HistoryList";
import { buildGraphElements } from "./utils/layout";
import { useTheme } from "./hooks/useTheme";
import {
  ApiError,
  expandMindmapNode,
  getMindmap,
  listMindmaps,
  streamMindmap,
} from "./api/client";
import type { Mindmap, MindmapSummary, ProgressEvent } from "./types";

const nodeTypes = { mindmapNode: MindmapNode };

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [inputText, setInputText] = useState("");
  const [mindmap, setMindmap] = useState<Mindmap | null>(null);
  const [history, setHistory] = useState<MindmapSummary[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => mindmap?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [mindmap, selectedNodeId],
  );

  const { nodes, edges } = useMemo(
    () => (mindmap ? buildGraphElements(mindmap) : { nodes: [], edges: [] }),
    [mindmap],
  );

  /**
   * React Flow owns node positions once mounted, which is what makes nodes
   * draggable. Remounting on this key is how a new map — or a drill-down that
   * adds nodes — gets a fresh layout; selection alone must not change it, or
   * every click would throw away the user's dragging.
   */
  const graphKey = mindmap ? `${mindmap.id}:${mindmap.nodes.length}` : "empty";

  /** Refreshes the sidebar list after a generate. */
  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await listMindmaps());
    } catch {
      // A failed history fetch must not bury the main flow; the list just
      // stays as it was.
    }
  }, []);

  // Initial load. State is set from the promise callback rather than the effect
  // body, and the cancelled flag stops a slow response landing after unmount.
  useEffect(() => {
    let cancelled = false;

    listMindmaps()
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch(() => {
        // An unreachable backend simply leaves the history empty.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const describeError = (caught: unknown) =>
    caught instanceof ApiError
      ? caught.message
      : caught instanceof Error
        ? caught.message
        : "Something went wrong.";

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress([]);
    setSelectedNodeId(null);

    try {
      const result = await streamMindmap(inputText, {
        onProgress: (event) => setProgress((events) => [...events, event]),
      });
      setMindmap(result);
      await refreshHistory();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [inputText, refreshHistory]);

  const handleSelectFromHistory = useCallback(async (id: string) => {
    setError(null);
    setProgress([]);
    setSelectedNodeId(null);
    try {
      setMindmap(await getMindmap(id));
    } catch (caught) {
      setError(describeError(caught));
    }
  }, []);

  const handleExpand = useCallback(
    async (nodeId: string) => {
      if (!mindmap) return;
      setExpandingNodeId(nodeId);
      setError(null);

      try {
        setMindmap(await expandMindmapNode(mindmap.id, nodeId));
      } catch (caught) {
        setError(describeError(caught));
      } finally {
        setExpandingNodeId(null);
      }
    },
    [mindmap],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<MindmapNodeData>) =>
      setSelectedNodeId(node.id),
    [],
  );

  return (
    <div className="scanlines relative flex h-screen w-screen overflow-hidden bg-bg font-terminal text-ink">
      <aside className="z-20 flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r-4 border-line bg-surface p-4 shadow-pixel-lg">
        <header className="flex items-center justify-between border-2 border-line bg-strong px-3 py-2 text-on-strong shadow-pixel-sm">
          <h1 className="font-pixel text-[10px] font-bold tracking-widest">
            MINDMAP.EXE
          </h1>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="border-2 border-line bg-line px-2 py-1 font-pixel text-[10px] text-strong hover:bg-highlight hover:text-on-highlight"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </header>

        <GeneratorForm
          value={inputText}
          onChange={setInputText}
          onSubmit={handleGenerate}
          isLoading={isLoading}
        />

        {error && (
          <div
            role="alert"
            className="border-2 border-line bg-danger p-2.5 font-terminal text-base leading-snug text-on-danger shadow-pixel-sm"
          >
            {error}
          </div>
        )}

        <ProgressLog events={progress} />

        {selectedNode && mindmap && (
          <SummaryPanel
            node={selectedNode}
            isRoot={selectedNode.id === mindmap.rootId}
            isExpanded={mindmap.expandedNodeIds.includes(selectedNode.id)}
            isExpanding={expandingNodeId === selectedNode.id}
            onExpand={handleExpand}
            onClose={() => setSelectedNodeId(null)}
          />
        )}

        <div className="mt-auto min-h-0 pt-2">
          <HistoryList
            items={history}
            activeId={mindmap?.id ?? null}
            onSelect={handleSelectFromHistory}
          />
        </div>
      </aside>

      <main className="relative h-full flex-1 bg-canvas">
        {!mindmap ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div
              aria-hidden="true"
              className="mb-5 animate-bounce text-6xl"
            >
              👾
            </div>
            <p className="font-pixel text-[11px] uppercase leading-relaxed tracking-widest text-accent">
              {isLoading ? "Compiling..." : "No map compiled yet"}
            </p>
            <p className="mt-2 max-w-md font-terminal text-lg text-muted">
              {isLoading
                ? "Watch the progress log on the left while the outline is extracted."
                : "Paste text into the terminal on the left, or load a sample, to run the visualiser."}
            </p>
          </div>
        ) : (
          <>
            <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[60%] border-2 border-line bg-surface px-3 py-2 shadow-pixel-sm">
              <p className="truncate font-pixel text-[10px] leading-relaxed text-highlight">
                {mindmap.title}
              </p>
              <p className="font-terminal text-base text-muted">
                {mindmap.nodes.length} nodes · {mindmap.connections.length} connections · click a
                node to read it, drag to rearrange
              </p>
            </div>

            <ReactFlow
              key={graphKey}
              defaultNodes={nodes}
              defaultEdges={edges}
              onNodeClick={handleNodeClick}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              nodesDraggable
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--grid)" gap={20} size={2} />
              <Controls className="!rounded-none !border-2 !border-line !bg-surface !shadow-pixel [&>button]:!border-b-2 [&>button]:!border-line [&>button]:!bg-surface [&>button]:!fill-[var(--accent)]" />
            </ReactFlow>
          </>
        )}
      </main>
    </div>
  );
}
