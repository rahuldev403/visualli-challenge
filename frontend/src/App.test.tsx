import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import type { Node } from "reactflow";

// Mock React Flow to avoid SVG rendering issues in JSDOM
vi.mock("reactflow", () => ({
  default: ({ onNodeClick, nodes }: { onNodeClick: (e: React.MouseEvent, node: Node) => void, nodes: Node[] }) => (
    <div data-testid="mock-react-flow">
      {nodes.map((node: Node) => (
        <button
          key={node.id}
          data-testid={`node-${node.id}`}
          onClick={(e) => onNodeClick(e, node)}
        >
          {node.data.label}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  useNodesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown) => [initial, vi.fn(), vi.fn()],
}));

describe("Mindmap App UI", () => {
  it("renders the initial empty state correctly", () => {
    render(<App />);
    expect(screen.getByText(/NO MAP COMPILED YET/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /COMPILE MAP/i }),
    ).toBeDisabled();
  });
});
