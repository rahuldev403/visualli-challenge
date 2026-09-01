import { Fragment, memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface MindmapNodeData {
  id: string;
  label: string;
  summary: string;
  /** 0 for the root, 1 for its ring, 2+ for drilled-down layers. */
  depth: number;
  /** First-ring subtree this node belongs to; -1 for the root. */
  branch: number;
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

/** How many distinct branch hues the palette defines. */
const BRANCH_HUES = 5;

/**
 * The fill for a node.
 *
 * The root is always the highlight colour; every other node takes the hue of
 * the branch it belongs to, so a subtree reads as one group and a drill-down
 * layer stays attached to its parent. A sixth-or-later branch folds into a
 * neutral rather than cycling a hue back onto an existing branch.
 *
 * These are inline styles rather than utility classes because the value is
 * data-driven — one of N palette slots chosen at runtime — which is exactly
 * the case a static class cannot express.
 */
function fillFor(data: MindmapNodeData): string {
  if (data.isRoot) return "var(--highlight)";
  if (data.branch < 0 || data.branch >= BRANCH_HUES) return "var(--cat-other)";
  return `var(--cat-${data.branch + 1})`;
}

function MindmapNode({ data, selected }: NodeProps<MindmapNodeData>) {
  const isDeep = data.depth >= 2;

  return (
    <div
      className={`relative select-none border-4 text-center font-terminal leading-tight tracking-wide transition-[box-shadow,transform] ${
        isDeep ? "max-w-[210px] px-3 py-2 text-lg" : "max-w-[240px] px-4 py-2.5 text-xl"
      } ${data.isRoot ? "min-w-[180px] uppercase" : isDeep ? "min-w-[130px]" : "min-w-[150px]"}`}
      style={{
        background: fillFor(data),
        color: data.isRoot ? "var(--on-highlight)" : "var(--on-cat)",
        borderColor: "var(--line)",
        // Selection adds a ring instead of recolouring, so a selected node
        // does not lose the branch colour that says where it belongs.
        boxShadow: selected
          ? "0 0 0 4px var(--highlight), 7px 7px 0 var(--shadow)"
          : "5px 5px 0 var(--shadow)",
        transform: selected ? "translate(-2px, -2px)" : undefined,
      }}
      title={data.summary}
      data-testid={`node-${data.id}`}
      data-depth={data.depth}
      data-branch={data.branch}
    >
      {SIDES.map(([name, position]) => (
        <Fragment key={name}>
          <Handle
            id={`t-${name}`}
            type="target"
            position={position}
            isConnectable={false}
            className="!pointer-events-none !h-1 !w-1 !border-0 !bg-transparent !opacity-0"
          />
          <Handle
            id={`s-${name}`}
            type="source"
            position={position}
            isConnectable={false}
            className="!pointer-events-none !h-1 !w-1 !border-0 !bg-transparent !opacity-0"
          />
        </Fragment>
      ))}

      <span className="block break-words">{data.label}</span>

      {data.isExpanded && (
        <span
          className="absolute -right-3 -top-3 border-2 px-1.5 font-pixel text-[9px]"
          style={{
            background: "var(--success)",
            color: "var(--on-highlight)",
            borderColor: "var(--line)",
          }}
          aria-label="already expanded"
        >
          +
        </span>
      )}
    </div>
  );
}

export default memo(MindmapNode);
