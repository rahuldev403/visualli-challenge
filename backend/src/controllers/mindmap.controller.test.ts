import request from "supertest";
import { createApp } from "../app";
import { MindmapRepository } from "../db/mindmap.repository";
import { MockProvider } from "../ai/mock.provider";
import { SOURCE_TEXT, invalidMindmap } from "../test/factories";
import { MAX_INPUT_CHARS } from "../shared/types";

/**
 * These run against the real router, controller, generator and repository with
 * only the provider seam faked, so they cover the wiring as well as the
 * handlers. MOCK_MODE is set in src/test/setupEnv.ts.
 */
const app = createApp();

beforeEach(() => MindmapRepository.reset());

describe("POST /api/mindmaps — request validation", () => {
  it.each([
    ["a missing text field", {}],
    ["an empty string", { text: "" }],
    ["whitespace only", { text: "   \n  " }],
    ["text too short to summarise", { text: "too short" }],
    ["a non-string text field", { text: 42 }],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await request(app).post("/api/mindmaps").send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REQUEST");
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("returns 400 for input long enough to raise token-limit concerns", async () => {
    const res = await request(app)
      .post("/api/mindmaps")
      .send({ text: "a".repeat(MAX_INPUT_CHARS + 1) });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.details)).toContain("at most");
  });
});

describe("POST /api/mindmaps — successful create flow", () => {
  it("generates, stores and returns a mindmap with an id and createdAt", async () => {
    const res = await request(app).post("/api/mindmaps").send({ text: SOURCE_TEXT });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
    expect(res.body.title).toBe("How Photosynthesis Works");
    expect(res.body.nodes).toHaveLength(6);

    // The contract the frontend relies on.
    const ids = new Set(res.body.nodes.map((n: { id: string }) => n.id));
    expect(ids.size).toBe(res.body.nodes.length);
    expect(ids.has(res.body.rootId)).toBe(true);
    expect(
      res.body.connections.every((c: { from: string; to: string }) => ids.has(c.from) && ids.has(c.to)),
    ).toBe(true);

    // Internals stay server-side.
    expect(res.body.sourceText).toBeUndefined();

    // And it really was persisted.
    const stored = await request(app).get(`/api/mindmaps/${res.body.id}`);
    expect(stored.status).toBe(200);
    expect(stored.body.title).toBe("How Photosynthesis Works");
  });

  it("surfaces a 422 instead of a stack trace when the model output cannot be repaired", async () => {
    jest
      .spyOn(MockProvider.prototype, "generateJson")
      .mockResolvedValue(JSON.stringify(invalidMindmap()));

    const res = await request(app).post("/api/mindmaps").send({ text: SOURCE_TEXT });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(res.text).not.toContain("at Object.");
  });

  it("returns a generic 500 without leaking internals when something unexpected throws", async () => {
    jest
      .spyOn(MockProvider.prototype, "generateJson")
      .mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:443 secret-internal-host"));

    const res = await request(app).post("/api/mindmaps").send({ text: SOURCE_TEXT });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "Something went wrong generating the mindmap.",
      code: "INTERNAL_ERROR",
    });
    expect(res.text).not.toContain("secret-internal-host");
  });
});

describe("GET /api/mindmaps", () => {
  it("returns an empty list before anything is generated", async () => {
    const res = await request(app).get("/api/mindmaps");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("lists id, title and createdAt only", async () => {
    await request(app).post("/api/mindmaps").send({ text: SOURCE_TEXT });

    const res = await request(app).get("/api/mindmaps");

    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual(["createdAt", "id", "title"]);
  });

  it("returns 404 with a clear message for an unknown id", async () => {
    const res = await request(app).get("/api/mindmaps/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
    expect(res.body.error).toContain("does-not-exist");
  });
});

describe("POST /api/mindmaps/:id/expand — drill-down", () => {
  const createMindmap = async () => {
    const res = await request(app).post("/api/mindmaps").send({ text: SOURCE_TEXT });
    return res.body;
  };

  it("returns the whole mindmap with the new layer merged in", async () => {
    const created = await createMindmap();

    const res = await request(app)
      .post(`/api/mindmaps/${created.id}/expand`)
      .send({ nodeId: "n5" });

    expect(res.status).toBe(201);
    expect(res.body.nodes.length).toBeGreaterThan(created.nodes.length);
    expect(res.body.expandedNodeIds).toEqual(["n5"]);

    const ids = new Set(res.body.nodes.map((n: { id: string }) => n.id));
    expect(ids.size).toBe(res.body.nodes.length);
    expect(
      res.body.connections.every((c: { from: string; to: string }) => ids.has(c.from) && ids.has(c.to)),
    ).toBe(true);
  });

  it("returns 400 when nodeId is missing", async () => {
    const created = await createMindmap();

    const res = await request(app).post(`/api/mindmaps/${created.id}/expand`).send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 when the node is not part of the mindmap", async () => {
    const created = await createMindmap();

    const res = await request(app)
      .post(`/api/mindmaps/${created.id}/expand`)
      .send({ nodeId: "not-a-node" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not-a-node");
  });

  it("returns 404 for an unknown mindmap", async () => {
    const res = await request(app).post("/api/mindmaps/nope/expand").send({ nodeId: "n1" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/mindmaps/stream — server-sent events", () => {
  /** Minimal SSE reader: collects `event:`/`data:` pairs from the response body. */
  const parseSse = (body: string) =>
    body
      .split("\n\n")
      .filter(Boolean)
      .map((chunk) => {
        const event = /^event: (.*)$/m.exec(chunk)?.[1] ?? "message";
        const data = /^data: (.*)$/m.exec(chunk)?.[1] ?? "{}";
        return { event, data: JSON.parse(data) };
      });

  it("streams progress phases and then the finished mindmap", async () => {
    const res = await request(app).post("/api/mindmaps/stream").send({ text: SOURCE_TEXT });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const events = parseSse(res.text);
    const phases = events.filter((e) => e.event === "progress").map((e) => e.data.phase);
    expect(phases).toEqual(["accepted", "outline", "outline-ready", "detail", "validated"]);

    // The outline arrives before the summaries — the whole point of streaming.
    const outlineEvent = events.find((e) => e.data.phase === "outline-ready");
    expect(outlineEvent!.data.outline.nodes.length).toBeGreaterThanOrEqual(5);

    const result = events.find((e) => e.event === "result");
    expect(result!.data.id).toEqual(expect.any(String));
    expect(result!.data.nodes).toHaveLength(6);
  });

  it("reports generation failures as a terminal error event, not a broken stream", async () => {
    jest
      .spyOn(MockProvider.prototype, "generateJson")
      .mockResolvedValue(JSON.stringify(invalidMindmap()));

    const res = await request(app).post("/api/mindmaps/stream").send({ text: SOURCE_TEXT });

    expect(res.status).toBe(200);
    const errorEvent = parseSse(res.text).find((e) => e.event === "error");
    expect(errorEvent!.data.code).toBe("SCHEMA_VALIDATION_FAILED");
  });

  it("rejects an invalid body with a normal 400 before opening the stream", async () => {
    const res = await request(app).post("/api/mindmaps/stream").send({ text: "" });

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});
