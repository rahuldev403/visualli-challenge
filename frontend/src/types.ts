/** Mirrors the contract the backend validates before anything is stored. */
export interface MindmapNode {
  id: string;
  label: string;
  summary: string;
}

export interface MindmapConnection {
  from: string;
  to: string;
  label: string;
}

export interface Mindmap {
  id: string;
  title: string;
  rootId: string;
  nodes: MindmapNode[];
  connections: MindmapConnection[];
  createdAt: string;
  /** Nodes already drilled into, so the UI does not offer to expand them twice. */
  expandedNodeIds: string[];
}

export interface MindmapSummary {
  id: string;
  title: string;
  createdAt: string;
}

/** Progress phases emitted by the streaming endpoint. */
export type ProgressPhase =
  | "accepted"
  | "outline"
  | "outline-ready"
  | "detail"
  | "repair"
  | "validated";

export interface ProgressEvent {
  phase: ProgressPhase;
  message: string;
  issues?: string[];
  outline?: {
    title: string;
    rootId: string;
    nodes: { id: string; label: string }[];
  };
}
