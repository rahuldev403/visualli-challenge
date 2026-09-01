import type { MindmapNode } from "../types";

interface SummaryPanelProps {
  node: MindmapNode;
  isRoot: boolean;
  isExpanded: boolean;
  isExpanding: boolean;
  onExpand: (nodeId: string) => void;
  onClose: () => void;
}

/**
 * The click-to-reveal summary, and the entry point for drilling deeper. The
 * expand control lives here rather than on the node itself so there is room to
 * say what it will do before it costs a model call.
 */
export default function SummaryPanel({
  node,
  isRoot,
  isExpanded,
  isExpanding,
  onExpand,
  onClose,
}: SummaryPanelProps) {
  return (
    <section
      aria-label="Node summary"
      className="panel-in border-2 border-accent bg-inset p-3 shadow-pixel-accent"
    >
      <header className="mb-2 flex items-start justify-between gap-2 border-b border-accent/40 pb-1">
        <h2 className="font-pixel text-[10px] uppercase leading-relaxed text-heading">
          {node.label}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close summary"
          className="pixel-chip shrink-0 bg-danger px-1.5 font-pixel text-[9px] text-on-danger hover:bg-strong hover:text-on-strong"
        >
          X
        </button>
      </header>

      <p className="font-terminal text-xl leading-snug text-ink">{node.summary}</p>

      <div className="mt-3">
        {isExpanded ? (
          <p className="font-terminal text-base leading-snug text-success">
            ✓ EXPANDED — CHILDREN ON CANVAS
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onExpand(node.id)}
            disabled={isExpanding}
            className="pixel-btn w-full bg-strong px-2 py-2 font-pixel text-[9px] uppercase tracking-wider text-on-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExpanding ? (
              <span className="inline-flex items-center gap-2">
                <span className="pixel-blink" aria-hidden="true">
                  ▮
                </span>
                DRILLING
              </span>
            ) : (
              "▼ DRILL DOWN"
            )}
          </button>
        )}
        {!isExpanded && (
          <p className="mt-2 font-terminal text-base leading-snug text-muted">
            {isRoot
              ? "Generates a deeper layer beneath the root."
              : `Generates 2-4 child ideas beneath "${node.label}".`}
          </p>
        )}
      </div>
    </section>
  );
}
