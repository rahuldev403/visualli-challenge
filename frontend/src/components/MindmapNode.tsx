import { Fragment, memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface MindmapNodeData {
  id: string;
  label: string;
  summary: string;
  /** 0 for the root, 1 for its ring, 2+ for drilled-down layers. */
  depth: number;
  isRoot: boolean;
  isExpanded: boolean;
}

/**
 * Handles on every side, all invisible.
 *
 * Edges pick whichever pair faces the other node (see `handleSidesFor` in
 * utils/layout), which is what stops connections in a radial layout from
 * looping around the outside of a box to reach a fixed top/bottom anchor.
 */
const SIDES = [
  ["top", Position.Top],
  ["right", Position.Right],
  ["bottom", Position.Bottom],
  ["left", Position.Left],
] as const;

/**
 * Three visual tiers: the root, the first ring, and drill-down children, which
 * are drawn a little smaller so a deeper layer reads as subordinate.
 *
 * Labels use the terminal face rather than the pixel face — the pixel face is
 * unreadable below about 10px, and node labels have to be read, not admired.
 */
function tierClasses(data: MindmapNodeData, selected: boolean): string {
  if (selected) {
    return "bg-accent text-on-accent shadow-pixel-highlight text-xl min-w-[150px]";
  }
  if (data.isRoot) {
    return "bg-highlight text-on-highlight shadow-pixel-strong text-2xl uppercase min-w-[170px]";
  }
  if (data.depth >= 2) {
    return "bg-surface text-ink hover:bg-node-hover shadow-pixel-sm text-lg min-w-[130px]";
  }
  return "bg-node text-node-ink hover:bg-node-hover shadow-pixel text-xl min-w-[150px]";
}

function MindmapNode({ data, selected }: NodeProps<MindmapNodeData>) {
  return (
    <div
      className={`relative select-none border-4 border-line px-4 py-2.5 text-center font-terminal leading-tight tracking-wide transition-colors max-w-[230px] ${tierClasses(
        data,
        selected,
      )}`}
      title={data.summary}
      data-testid={`node-${data.id}`}
      data-depth={data.depth}
    >
      {SIDES.map(([name, position]) => (
        <Fragment key={name}>
          <Handle
            id={`t-${name}`}
            type="target"
            position={position}
            isConnectable={false}
            className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
          />
          <Handle
            id={`s-${name}`}
            type="source"
            position={position}
            isConnectable={false}
            className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
          />
        </Fragment>
      ))}

      <span className="block break-words">{data.label}</span>

      {data.isExpanded && (
        <span
          className="absolute -right-2.5 -top-2.5 border-2 border-line bg-success px-1.5 font-pixel text-[8px] text-on-highlight"
          aria-label="already expanded"
        >
          +
        </span>
      )}
    </div>
  );
}

export default memo(MindmapNode);
