import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface MindmapNodeData {
  id: string;
  label: string;
  summary: string;
  /** 0 for the root, 1 for its ring, 2+ for drilled-down layers. */
  depth: number;
  isRoot: boolean;
  isSelected: boolean;
  isExpanded: boolean;
}

/**
 * Three visual tiers: the root, the first ring, and drill-down children, which
 * are drawn smaller so a deeper layer reads as subordinate to its parent.
 */
function tierClasses({ isRoot, isSelected, depth }: MindmapNodeData): string {
  if (isRoot) {
    return "bg-highlight text-line shadow-pixel-strong font-pixel text-[10px] uppercase min-w-[150px]";
  }
  if (isSelected) {
    return "bg-accent text-line shadow-pixel-highlight font-pixel text-[9px] min-w-[130px]";
  }
  if (depth >= 2) {
    return "bg-surface text-accent hover:bg-node-hover shadow-pixel-sm font-pixel text-[7px] min-w-[100px] opacity-95";
  }
  return "bg-node text-node-ink hover:bg-node-hover shadow-pixel font-pixel text-[8px] min-w-[120px]";
}

function MindmapNode({ data }: NodeProps<MindmapNodeData>) {
  const { label, isExpanded, depth, summary } = data;

  return (
    <div
      className={`relative cursor-pointer border-4 border-line px-3 py-2 text-center transition-colors max-w-[190px] ${tierClasses(
        data,
      )}`}
      title={summary}
      data-testid={`node-${data.id}`}
      data-depth={depth}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-none !border-2 !border-line !bg-accent"
      />

      <div className="break-words leading-snug tracking-tight">{label}</div>

      {/* A small marker rather than a button: expansion is driven from the
          summary panel, where there is room to explain what it does. */}
      {isExpanded && (
        <span
          className="absolute -right-2 -top-2 border-2 border-line bg-success px-1 font-pixel text-[7px] text-line"
          aria-label="already expanded"
        >
          +
        </span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-none !border-2 !border-line !bg-strong"
      />
    </div>
  );
}

export default memo(MindmapNode);
