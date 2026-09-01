import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import App from "./App";
import type { MindmapNodeData } from "./components/MindmapNode";
import { ApiError, expandMindmapNode, listMindmaps, streamMindmap } from "./api/client";
import type { Mindmap } from "./types";

/**
 * React Flow renders through a canvas-ish layout pipeline that jsdom cannot
 * measure, so it is replaced with a list of buttons that call the same
 * `onNodeClick` contract. What is under test is App's behaviour — which node id
 * was clicked and what it reveals — not React Flow's rendering.
 */
vi.mock("reactflow", () => ({
  default: ({
    nodes,
    onNodeClick,
  }: {
    nodes: Node<MindmapNodeData>[];
    onNodeClick: (event: React.MouseEvent, node: Node<MindmapNodeData>) => void;
  }) => (
    <div data-testid="graph">
      {nodes.map((node) => (
        <button
          key={node.id}
          data-testid={`graph-node-${node.id}`}
          onClick={(event) => onNodeClick(event, node)}
        >
          {node.data.label}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
}));

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof import("./api/client")>("./api/client");
  return {
    ApiError: actual.ApiError,
    streamMindmap: vi.fn(),
    listMindmaps: vi.fn(),
    getMindmap: vi.fn(),
    expandMindmapNode: vi.fn(),
    createMindmap: vi.fn(),
  };
});

const MINDMAP: Mindmap = {
  id: "map-1",
  title: "How Photosynthesis Works",
  rootId: "n1",
  createdAt: "2026-09-01T10:00:00.000Z",
  expandedNodeIds: [],
  nodes: [
    { id: "n1", label: "Photosynthesis", summary: "Plants turn light into chemical energy." },
    { id: "n2", label: "Chlorophyll", summary: "The green pigment that absorbs sunlight." },
    { id: "n3", label: "Glucose", summary: "The sugar the reaction produces." },
  ],
  connections: [
    { from: "n1", to: "n2", label: "uses" },
    { from: "n1", to: "n3", label: "produces" },
  ],
};

const SOURCE_TEXT =
  "Photosynthesis lets plants turn sunlight into sugar using chlorophyll in their leaves.";

const generate = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/input raw data/i), SOURCE_TEXT);
  await user.click(screen.getByRole("button", { name: /compile map/i }));
  return user;
};

beforeEach(() => {
  vi.mocked(listMindmaps).mockResolvedValue([]);
  vi.mocked(streamMindmap).mockResolvedValue(MINDMAP);
  vi.mocked(expandMindmapNode).mockResolvedValue(MINDMAP);
});

describe("empty and error states", () => {
  it("shows the empty state before anything has been generated", async () => {
    render(<App />);

    expect(screen.getByText(/no map compiled yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /compile map/i })).toBeDisabled();
    await waitFor(() => expect(screen.getByText(/no mindmaps saved yet/i)).toBeInTheDocument());
  });

  it("enables the submit button once the text is long enough", async () => {
    const user = userEvent.setup();
    render(<App />);

    const submit = screen.getByRole("button", { name: /compile map/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/input raw data/i), SOURCE_TEXT);
    expect(submit).toBeEnabled();
  });

  it("shows a backend error in the UI rather than only the console", async () => {
    vi.mocked(streamMindmap).mockRejectedValue(
      new ApiError("The model returned an invalid mindmap twice.", "SCHEMA_VALIDATION_FAILED"),
    );
    render(<App />);

    await generate();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid mindmap twice/i);
    expect(screen.getByText(/no map compiled yet/i)).toBeInTheDocument();
  });
});

describe("click to reveal a node summary", () => {
  it("renders the returned mindmap as a node-link graph", async () => {
    render(<App />);
    await generate();

    await waitFor(() => expect(screen.getByTestId("graph")).toBeInTheDocument());
    expect(screen.getByTestId("graph-node-n1")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-n2")).toBeInTheDocument();
    expect(screen.getByTestId("graph-node-n3")).toBeInTheDocument();
  });

  it("reveals a node's summary when that node is clicked", async () => {
    render(<App />);
    const user = await generate();

    await waitFor(() => expect(screen.getByTestId("graph-node-n2")).toBeInTheDocument());

    // Nothing is revealed until a node is clicked.
    expect(screen.queryByRole("region", { name: /node summary/i })).not.toBeInTheDocument();

    await user.click(screen.getByTestId("graph-node-n2"));

    const panel = await screen.findByRole("region", { name: /node summary/i });
    expect(within(panel).getByText(/the green pigment that absorbs sunlight/i)).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: /chlorophyll/i })).toBeInTheDocument();
  });

  it("swaps the summary when a different node is clicked", async () => {
    render(<App />);
    const user = await generate();
    await waitFor(() => expect(screen.getByTestId("graph-node-n2")).toBeInTheDocument());

    await user.click(screen.getByTestId("graph-node-n2"));
    expect(await screen.findByText(/the green pigment/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("graph-node-n3"));

    const panel = await screen.findByRole("region", { name: /node summary/i });
    expect(within(panel).getByText(/the sugar the reaction produces/i)).toBeInTheDocument();
    expect(screen.queryByText(/the green pigment/i)).not.toBeInTheDocument();
  });

  it("closes the summary again", async () => {
    render(<App />);
    const user = await generate();
    await waitFor(() => expect(screen.getByTestId("graph-node-n2")).toBeInTheDocument());

    await user.click(screen.getByTestId("graph-node-n2"));
    await user.click(await screen.findByRole("button", { name: /close summary/i }));

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /node summary/i })).not.toBeInTheDocument(),
    );
  });
});

describe("drill-down", () => {
  it("expands the clicked node and merges the returned layer", async () => {
    const expanded: Mindmap = {
      ...MINDMAP,
      expandedNodeIds: ["n3"],
      nodes: [
        ...MINDMAP.nodes,
        { id: "n3x1", label: "Starch Storage", summary: "Surplus glucose is stored as starch." },
      ],
      connections: [...MINDMAP.connections, { from: "n3", to: "n3x1", label: "stored as" }],
    };
    vi.mocked(expandMindmapNode).mockResolvedValue(expanded);

    render(<App />);
    const user = await generate();
    await waitFor(() => expect(screen.getByTestId("graph-node-n3")).toBeInTheDocument());

    await user.click(screen.getByTestId("graph-node-n3"));
    await user.click(await screen.findByRole("button", { name: /drill down/i }));

    expect(expandMindmapNode).toHaveBeenCalledWith("map-1", "n3");
    await waitFor(() => expect(screen.getByTestId("graph-node-n3x1")).toBeInTheDocument());
  });

  it("surfaces an expansion failure without losing the existing map", async () => {
    vi.mocked(expandMindmapNode).mockRejectedValue(
      new ApiError("Could not generate a child layer.", "SCHEMA_VALIDATION_FAILED"),
    );

    render(<App />);
    const user = await generate();
    await waitFor(() => expect(screen.getByTestId("graph-node-n3")).toBeInTheDocument());

    await user.click(screen.getByTestId("graph-node-n3"));
    await user.click(await screen.findByRole("button", { name: /drill down/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not generate a child layer/i);
    expect(screen.getByTestId("graph-node-n3")).toBeInTheDocument();
  });
});

describe("streaming progress", () => {
  it("shows each phase reported by the stream, including a repair retry", async () => {
    vi.mocked(streamMindmap).mockImplementation(async (_text, options) => {
      options?.onProgress?.({ phase: "accepted", message: "Input accepted" });
      options?.onProgress?.({ phase: "outline", message: "Extracting outline" });
      options?.onProgress?.({
        phase: "repair",
        message: "Model output failed validation, retrying with corrections",
        issues: ["node ids must be unique"],
      });
      options?.onProgress?.({ phase: "validated", message: "Validated 3 nodes" });
      return MINDMAP;
    });

    render(<App />);
    await generate();

    const log = await screen.findByRole("region", { name: /generation progress/i });
    expect(within(log).getByText(/extracting outline/i)).toBeInTheDocument();
    expect(within(log).getByText(/retrying with corrections/i)).toBeInTheDocument();
    expect(within(log).getByText(/node ids must be unique/i)).toBeInTheDocument();
  });
});
