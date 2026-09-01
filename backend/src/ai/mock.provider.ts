import type { Mindmap } from "../shared/types";
import { matchFixture, syntheticExpansion, syntheticMindmap } from "./fixtures";
import { ProviderError } from "./errors";
import type { LlmProvider, LlmRequest } from "./provider";

/**
 * MOCK_MODE provider. It answers the same four tasks a real provider answers
 * and returns a raw JSON string, so the generator's parse, validate and repair
 * path runs exactly as it does against Gemini — mock mode skips the network
 * call, not the safety net.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async generateJson(request: LlmRequest): Promise<string> {
    const context = request.context ?? {};
    const sourceText = context.sourceText ?? "";

    // Opt-in fault injection: makes the corrective-retry path demonstrable with
    // no API key. The first attempt returns output that fails validation.
    if (process.env.MOCK_FAIL_FIRST === "true" && (context.attempt ?? 0) === 0) {
      return JSON.stringify(this.deliberatelyBrokenPayload(request));
    }

    const base = this.baseMindmap(sourceText);

    switch (request.task) {
      case "single":
        return JSON.stringify(base);

      case "outline":
        return JSON.stringify({
          title: base.title,
          rootId: base.rootId,
          nodes: base.nodes.map(({ id, label }) => ({ id, label })),
        });

      case "detail": {
        // Honour the ids phase 1 settled on, exactly as a real model is asked to.
        const ids = context.outline?.nodes.map((n) => n.id) ?? base.nodes.map((n) => n.id);
        const byId = new Map(base.nodes.map((n) => [n.id, n]));
        return JSON.stringify({
          summaries: ids.map((id) => ({
            id,
            summary: byId.get(id)?.summary ?? "Summary unavailable in mock mode.",
          })),
          connections: base.connections.filter(
            (c) => ids.includes(c.from) && ids.includes(c.to),
          ),
        });
      }

      case "expansion": {
        const parent = context.parent;
        if (!parent) throw new ProviderError("Mock expansion requested without a parent node");

        const fixture = matchFixture(sourceText);
        const canned = fixture?.expansions[parent.id];
        return JSON.stringify(canned ?? syntheticExpansion(parent, context.idPrefix ?? "x"));
      }
    }
  }

  /** A matched fixture if the text looks like a demo input, else a synthetic map. */
  private baseMindmap(sourceText: string): Mindmap {
    return matchFixture(sourceText)?.mindmap ?? syntheticMindmap(sourceText);
  }

  /**
   * Output that is valid JSON and matches the rough shape, but violates the
   * semantic rules the schema enforces: a duplicate id, a dangling edge and a
   * self-loop. Exactly the class of mistake real models make.
   */
  private deliberatelyBrokenPayload(request: LlmRequest) {
    if (request.task === "detail") {
      // Shaped correctly, but references an id phase 1 never produced and
      // points one connection at its own node.
      const ids = request.context?.outline?.nodes.map((n) => n.id) ?? ["n1"];
      return {
        summaries: [
          ...ids.map((id) => ({ id, summary: "A plausible-looking summary." })),
          { id: "hallucinated", summary: "A node the outline never defined." },
        ],
        connections: [
          { from: ids[0] as string, to: "hallucinated", label: "invented" },
          { from: ids[0] as string, to: ids[0] as string, label: "self loop" },
        ],
      };
    }

    if (request.task === "expansion") {
      const parentId = request.context?.parent?.id ?? "n1";
      return {
        nodes: [
          { id: "dup", label: "Broken Child", summary: "A deliberately invalid mock child." },
          { id: "dup", label: "Duplicate Id", summary: "Shares an id with its sibling." },
        ],
        connections: [{ from: parentId, to: "ghost", label: "dangling" }],
      };
    }

    return {
      title: "Deliberately Invalid Mock Output",
      rootId: "does-not-exist",
      nodes: [
        { id: "a1", label: "First", summary: "Valid enough on its own." },
        { id: "a1", label: "Duplicate Id", summary: "Shares an id with the node above." },
        { id: "a3", label: "Third", summary: "Fine." },
        { id: "a4", label: "Fourth", summary: "Fine." },
        { id: "a5", label: "Fifth", summary: "Fine." },
      ],
      connections: [
        { from: "a1", to: "ghost", label: "dangling edge" },
        { from: "a3", to: "a3", label: "self loop" },
      ],
    };
  }
}
