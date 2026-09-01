import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface CustomNodeData {
  id: string;
  label: string;
  summary: string;
  isRoot: boolean;
  isSelected: boolean;
  colorTheme?: string;
}

const MindmapNodeComponent: React.FC<NodeProps<CustomNodeData>> = ({
  data,
}) => {
  const { label, isRoot, isSelected } = data;

  return (
    <div
      className={`px-3 py-2 cursor-pointer text-center min-w-[120px] max-w-[190px] border-4 border-black transition-all ${
        isRoot
          ? "bg-[#ffe600] text-black shadow-[5px_5px_0px_#ff2a85] font-pixel text-[10px] uppercase"
          : isSelected
            ? "bg-[#00f0ff] text-black shadow-[5px_5px_0px_#ffe600] font-pixel text-[9px]"
            : "bg-[#2b1055] text-[#39ff14] hover:bg-[#3d1a75] shadow-[4px_4px_0px_#000] font-pixel text-[8px]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#00f0ff] !border-2 !border-black !rounded-none !w-3 !h-3"
      />
      <div className="leading-snug break-words tracking-tight">{label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#ff2a85] !border-2 !border-black !rounded-none !w-3 !h-3"
      />
    </div>
  );
};

export default memo(MindmapNodeComponent);
