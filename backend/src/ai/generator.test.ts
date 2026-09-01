import { InvalidInputError, SchemaValidationError } from "./errors";
import { expandNode, generateMindmap } from "./generator";
import { MockProvider } from "./mock.provider";
import { MindmapRepository } from "../db/mindmap.repository";
import { MAX_INPUT_CHARS } from "../shared/types";
import { SOURCE_TEXT, invalidMindmap, validMindmap } from "../test/factories";

const stubProvider = () => jest.spyOn(MockProvider.prototype, "generateJson");

describe("generateMindmap — validation and schema repair", () => {
  it("retries once with a corrective prompt when the model breaks the contract", async () => {
    const provider = stubProvider()
      .mockResolvedValueOnce(JSON.stringify(invalidMindmap()))
      .mockResolvedValueOnce(JSON.stringify(validMindmap()));

    const result = await generateMindmap(SOURCE_TEXT, { mode: "single" });

    expect(provider).toHaveBeenCalledTimes(2);
    expect(result).toEqual(validMindmap());
    const retryPrompt = provider.mock.calls[1]![0].prompt;
    expect(retryPrompt).toContain("Your previous response was rejected by a strict validator");
    expect(retryPrompt).toContain("missing-root");
    expect(retryPrompt).toContain("node ids must be unique");
    expect(retryPrompt).toContain("rootId must match the id of a real node");
    expect(retryPrompt).toContain("every connection must reference an existing node id");
  });

  it("gives up after exactly one retry and reports a schema failure", async () => {
    const provider = stubProvider().mockResolvedValue(JSON.stringify(invalidMindmap()));

    await expect(generateMindmap(SOURCE_TEXT, { mode: "single" })).rejects.toBeInstanceOf(
      SchemaValidationError,
    );
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("treats unparseable output the same as invalid output and repairs it", async () => {
    const provider = stubProvider()
      .mockResolvedValueOnce("Sure! Here is your mindmap:\n```json\n{ nodes: [")
      .mockResolvedValueOnce(JSON.stringify(validMindmap()));

    const result = await generateMindmap(SOURCE_TEXT, { mode: "single" });

    expect(result.nodes).toHaveLength(5);
    expect(provider.mock.calls[1]![0].prompt).toContain("the response was not valid JSON");
  });

  it.each([
    [
      "a dangling edge",
      { ...validMindmap(), connections: [{ from: "n1", to: "nope", label: "dangling" }] },
      "every connection must reference an existing node id",
    ],
    [
      "duplicate node ids",
      {
        ...validMindmap(),
        nodes: validMindmap().nodes.map((n, i) => (i === 1 ? { ...n, id: "n1" } : n)),
      },
      "node ids must be unique",
    ],
    [
      "a rootId matching no node",
      { ...validMindmap(), rootId: "n99" },
      "rootId must match the id of a real node",
    ],
    [
      "too few nodes",
      { ...validMindmap(), nodes: validMindmap().nodes.slice(0, 3) },
      "Too small",
    ],
    [
      "a label longer than four words",
      {
        ...validMindmap(),
        nodes: validMindmap().nodes.map((n, i) =>
          i === 0 ? { ...n, label: "One Two Three Four Five" } : n,
        ),
      },
      "label must be at most 4 words",
    ],
  ])("rejects %s", async (_name, payload, expectedIssue) => {
    const provider = stubProvider().mockResolvedValue(JSON.stringify(payload));

    await expect(generateMindmap(SOURCE_TEXT, { mode: "single" })).rejects.toThrow(
      SchemaValidationError,
    );
    expect(provider.mock.calls[1]![0].prompt).toContain(expectedIssue);
  });
});

describe("generateMindmap — input guards", () => {
  it.each([
    ["empty input", ""],
    ["whitespace only", "        \n\t  "],
    ["input too short to summarise", "Too short."],
  ])("rejects %s before calling the provider", async (_name, input) => {
    const provider = stubProvider();

    await expect(generateMindmap(input)).rejects.toBeInstanceOf(InvalidInputError);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects input long enough to raise token-limit concerns", async () => {
    const provider = stubProvider();
    const tooLong = "word ".repeat(MAX_INPUT_CHARS);

    await expect(generateMindmap(tooLong)).rejects.toThrow(/at most 12000 characters/);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe("generateMindmap — two-phase generation", () => {
  it("emits outline progress before the summaries are written", async () => {
    const events: string[] = [];

    const result = await generateMindmap(SOURCE_TEXT, {
      onProgress: (event) => events.push(event.phase),
    });

    expect(events).toEqual(["accepted", "outline", "outline-ready", "detail", "validated"]);
    expect(result.nodes.length).toBeGreaterThanOrEqual(5);
    expect(result.nodes.every((n) => n.summary.length > 0)).toBe(true);
  });

  it("rejects a phase-2 response that invents an id the outline never defined", async () => {
    const outline = {
      title: "How Photosynthesis Works",
      rootId: "n1",
      nodes: validMindmap().nodes.map(({ id, label }) => ({ id, label })),
    };
    const detailWithUnknownId = {
      summaries: [
        ...validMindmap().nodes.map(({ id, summary }) => ({ id, summary })),
        { id: "hallucinated", summary: "A node phase 1 never produced." },
      ],
      connections: [{ from: "n1", to: "hallucinated", label: "invented" }],
    };

    const provider = stubProvider()
      .mockResolvedValueOnce(JSON.stringify(outline))
      .mockResolvedValue(JSON.stringify(detailWithUnknownId));

    await expect(generateMindmap(SOURCE_TEXT)).rejects.toThrow(SchemaValidationError);

    // Outline once, then detail twice — the repair re-runs phase 2 only.
    expect(provider).toHaveBeenCalledTimes(3);
    expect(provider.mock.calls[2]![0].prompt).toContain(
      "a summary referenced a node id that is not in the outline",
    );
  });
});

describe("MOCK_MODE", () => {
  beforeEach(() => MindmapRepository.reset());

  it("returns a canned fixture for a known input without calling a provider", async () => {
    const result = await generateMindmap(SOURCE_TEXT);

    expect(result.title).toBe("How Photosynthesis Works");
    expect(result.nodes).toHaveLength(6);
    expect(result.nodes.map((n) => n.label)).toContain("Chlorophyll");
  });

  it("still produces a valid mindmap for text that matches no fixture", async () => {
    const result = await generateMindmap(
      "The quarterly budget review covered marketing spend. Headcount was frozen until " +
        "the next fiscal year. Travel costs came in under forecast. The board asked for a " +
        "revised model by March.",
    );

    expect(result.nodes.length).toBeGreaterThanOrEqual(5);
    expect(result.nodes.length).toBeLessThanOrEqual(9);
    expect(new Set(result.nodes.map((n) => n.id)).size).toBe(result.nodes.length);
  });

  it("exercises the real repair path end to end when MOCK_FAIL_FIRST is set", async () => {
    process.env.MOCK_FAIL_FIRST = "true";
    const repairs: string[][] = [];

    try {
      const result = await generateMindmap(SOURCE_TEXT, {
        mode: "single",
        onProgress: (event) => {
          if (event.phase === "repair") repairs.push(event.issues);
        },
      });

      expect(repairs).toHaveLength(1);
      expect(repairs[0]!.join(" ")).toContain("node ids must be unique");
      expect(result.nodes).toHaveLength(6);
    } finally {
      delete process.env.MOCK_FAIL_FIRST;
    }
  });
});

describe("expandNode — drill-down", () => {
  beforeEach(() => MindmapRepository.reset());

  const storedMindmap = () => MindmapRepository.create(validMindmap(), SOURCE_TEXT);

  it("generates a child layer scoped to the node being expanded", async () => {
    const record = storedMindmap();

    const expansion = await expandNode({ mindmap: record, nodeId: "n5", sourceText: SOURCE_TEXT });

    expect(expansion.nodes.length).toBeGreaterThanOrEqual(2);
    expect(expansion.connections.every((c) => c.from === "n5")).toBe(true);
    // Every new node hangs off the expanded node and nothing else.
    const newIds = new Set(expansion.nodes.map((n) => n.id));
    expect(expansion.connections.every((c) => newIds.has(c.to))).toBe(true);
  });

  it("rejects an expansion whose ids collide with the existing graph", async () => {
    const record = storedMindmap();
    const provider = stubProvider().mockResolvedValue(
      JSON.stringify({
        nodes: [
          { id: "n2", label: "Collides", summary: "Reuses an id already in the mindmap." },
          { id: "n3", label: "Also Collides", summary: "So does this one." },
        ],
        connections: [
          { from: "n5", to: "n2", label: "child" },
          { from: "n5", to: "n3", label: "child" },
        ],
      }),
    );

    await expect(
      expandNode({ mindmap: record, nodeId: "n5", sourceText: SOURCE_TEXT }),
    ).rejects.toThrow(SchemaValidationError);

    expect(provider.mock.calls[1]![0].prompt).toContain(
      "new node ids must not collide with nodes already in the mindmap",
    );
  });

  it("refuses to expand a node that does not exist", async () => {
    const record = storedMindmap();

    await expect(expandNode({ mindmap: record, nodeId: "nope" })).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("merges a validated expansion into the stored mindmap", async () => {
    const record = storedMindmap();
    const expansion = await expandNode({ mindmap: record, nodeId: "n5", sourceText: SOURCE_TEXT });

    const updated = MindmapRepository.appendExpansion(record.id, "n5", expansion);

    expect(updated!.nodes).toHaveLength(record.nodes.length + expansion.nodes.length);
    expect(updated!.expandedNodeIds).toEqual(["n5"]);
    // The merged graph still has unique ids and no dangling edges.
    const ids = new Set(updated!.nodes.map((n) => n.id));
    expect(ids.size).toBe(updated!.nodes.length);
    expect(updated!.connections.every((c) => ids.has(c.from) && ids.has(c.to))).toBe(true);
  });
});
