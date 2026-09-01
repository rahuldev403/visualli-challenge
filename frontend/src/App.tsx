import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, type Node } from "reactflow";

import MindmapNode, { type MindmapNodeData } from "./components/MindmapNode";
import GeneratorForm from "./components/GeneratorForm";
import ProgressLog from "./components/ProgressLog";
import SummaryPanel from "./components/SummaryPanel";
import HistoryList from "./components/HistoryList";
import LoadingBar from "./components/LoadingBar";
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
  const [isDismissingProgress, setIsDismissingProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timers that retire the finished progress log. Held in a ref so a second
  // run, or an unmount, can cancel a dismissal still in flight.
  const dismissTimers = useRef<number[]>([]);

  const cancelDismiss = useCallback(() => {
    dismissTimers.current.forEach(clearTimeout);
    dismissTimers.current = [];
  }, []);

  useEffect(() => cancelDismiss, [cancelDismiss]);

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
    cancelDismiss();
    setIsLoading(true);
    setError(null);
    setProgress([]);
    setIsDismissingProgress(false);
    setSelectedNodeId(null);

    try {
      const result = await streamMindmap(inputText, {
        onProgress: (event) => setProgress((events) => [...events, event]),
      });
      setMindmap(result);
      await refreshHistory();

      // Let the completed log read for a beat, fade it, then drop it. On
      // failure it stays put — that is exactly when you want to see it.
      dismissTimers.current.push(
        window.setTimeout(() => setIsDismissingProgress(true), 1400),
        window.setTimeout(() => {
          setProgress([]);
          setIsDismissingProgress(false);
        }, 1900),
      );
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [cancelDismiss, inputText, refreshHistory]);

  const handleSelectFromHistory = useCallback(async (id: string) => {
    cancelDismiss();
    setError(null);
    setProgress([]);
    setIsDismissingProgress(false);
    setSelectedNodeId(null);
    try {
      setMindmap(await getMindmap(id));
    } catch (caught) {
      setError(describeError(caught));
    }
  }, [cancelDismiss]);

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
    <div className="relative flex h-screen w-screen overflow-hidden bg-bg font-terminal text-ink">
      <aside className="z-20 flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-r-4 border-line bg-surface p-4 shadow-pixel-lg">
        <header className="flex items-center justify-between gap-3 border-2 border-line bg-strong px-3 py-2.5 text-on-strong shadow-pixel-sm">
          <h1 className="font-pixel text-[13px] font-bold leading-none tracking-widest">
            MINDMAP.EXE
          </h1>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="pixel-chip shrink-0 bg-highlight px-2.5 py-1.5 font-terminal text-lg uppercase leading-none tracking-wide text-on-highlight hover:bg-accent hover:text-on-accent"
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
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
            className="panel-in border-2 border-line bg-danger p-2.5 font-terminal text-base leading-snug text-on-danger shadow-pixel-sm"
          >
            {error}
          </div>
        )}

        {isLoading && <LoadingBar label="Generating" />}

        <ProgressLog
          events={progress}
          isDismissing={isDismissingProgress}
          isRunning={isLoading}
        />

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
            {isLoading && (
              <div className="mt-5 w-64">
                <LoadingBar />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[60%] border-2 border-line bg-surface px-3 py-2 shadow-pixel-sm">
              <p className="truncate font-pixel text-[11px] leading-relaxed text-heading">
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
