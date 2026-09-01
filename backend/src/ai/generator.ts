import { z } from "zod";
import {
  DetailSchema,
  ExpansionSchema,
  MAX_EXPANSION_NODES,
  MAX_INPUT_CHARS,
  MIN_EXPANSION_NODES,
  MIN_INPUT_CHARS,
  MindmapSchema,
  OutlineSchema,
  type Expansion,
  type Mindmap,
  type Outline,
  type StoredMindmap,
} from "../shared/types";
import { InvalidInputError, ProviderError, SchemaValidationError } from "./errors";
import { GeminiProvider } from "./gemini.provider";
import { MockProvider } from "./mock.provider";
import { isMockMode, type GenerationContext, type LlmProvider, type LlmTask } from "./provider";
import { detailPrompt, expansionPrompt, outlinePrompt, repairPrompt, singlePassPrompt } from "./prompts";

/* ------------------------------------------------------------------ *
 * Progress events (consumed by the SSE endpoint)
 * ------------------------------------------------------------------ */

export type ProgressEvent =
  | { phase: "accepted"; message: string }
  | { phase: "outline"; message: string }
  | { phase: "outline-ready"; message: string; outline: Outline }
  | { phase: "detail"; message: string }
  | { phase: "repair"; message: string; issues: string[] }
  | { phase: "validated"; message: string };

export type OnProgress = (event: ProgressEvent) => void;

const noop: OnProgress = () => {};

/* ------------------------------------------------------------------ *
 * Provider selection
 * ------------------------------------------------------------------ */

const mockProvider = new MockProvider();
const geminiProvider = new GeminiProvider();

export const resolveProvider = (): LlmProvider => (isMockMode() ? mockProvider : geminiProvider);

/* ------------------------------------------------------------------ *
 * The untrusted-output boundary
 * ------------------------------------------------------------------ */

/** JSON Schemas are derived once from the Zod schemas and reused. */
const jsonSchemaCache = new WeakMap<object, unknown>();
const jsonSchemaFor = (schema: z.ZodType): unknown => {
  const cached = jsonSchemaCache.get(schema);
  if (cached) return cached;
  const generated = z.toJSONSchema(schema, { io: "input" });
  jsonSchemaCache.set(schema, generated);
  return generated;
};

const formatIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

/**
 * Ask the provider for one structured payload and refuse to return it until it
 * satisfies `schema`.
 *
 * This is the single place model output crosses from "text someone sent us" to
 * "a value the rest of the app may rely on". On failure it retries exactly once
 * with a corrective prompt carrying the model's own output plus the precise
 * validator messages it violated — a plain re-ask would just reroll the dice.
 */
async function requestValidated<T>(args: {
  task: LlmTask;
  prompt: string;
  schema: z.ZodType<T>;
  context?: GenerationContext;
  onProgress?: OnProgress;
}): Promise<T> {
  const { task, prompt, schema, context = {}, onProgress = noop } = args;
  const provider = resolveProvider();
  const jsonSchema = jsonSchemaFor(schema);
  const attempts: string[] = [];

  let currentPrompt = prompt;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const raw = await provider.generateJson({
      task,
      prompt: currentPrompt,
      jsonSchema,
      context: { ...context, attempt },
    });
    attempts.push(raw);

    let issues: string[];
    try {
      // Both failure modes land here: unparseable text, and text that parses
      // but breaks the contract. They are handled identically on purpose.
      const parsed: unknown = JSON.parse(raw);
      return schema.parse(parsed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        issues = formatIssues(error);
      } else if (error instanceof SyntaxError) {
        issues = ["the response was not valid JSON"];
      } else {
        throw error;
      }
    }

    if (attempt === 0) {
      onProgress({
        phase: "repair",
        message: `Model output failed validation, retrying with corrections (${issues.length} issue${
          issues.length === 1 ? "" : "s"
        })`,
        issues,
      });
      currentPrompt = repairPrompt(prompt, raw, issues.map((i) => `- ${i}`).join("\n"));
      continue;
    }

    throw new SchemaValidationError(
      `The model returned an invalid ${task} payload twice. Last errors: ${issues.join("; ")}`,
      attempts,
    );
  }

  /* c8 ignore next */
  throw new ProviderError("unreachable");
}

/* ------------------------------------------------------------------ *
 * Input guards
 * ------------------------------------------------------------------ */

/**
 * Rejected before a token is spent. Long input is refused outright rather than
 * silently truncated: quietly summarising half of someone's document and
 * presenting it as the whole thing is worse than a clear error.
 */
export function assertUsableInput(text: unknown): string {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new InvalidInputError("text is required and must be a non-empty string");
  }
  const trimmed = text.trim();
  if (trimmed.length < MIN_INPUT_CHARS) {
    throw new InvalidInputError(
      `text must be at least ${MIN_INPUT_CHARS} characters to summarise meaningfully (received ${trimmed.length})`,
    );
  }
  if (trimmed.length > MAX_INPUT_CHARS) {
    throw new InvalidInputError(
      `text must be at most ${MAX_INPUT_CHARS} characters (received ${trimmed.length}). Please trim the input or split it into sections.`,
    );
  }
  return trimmed;
}

/* ------------------------------------------------------------------ *
 * Part 1: generateMindmap(text) => Mindmap
 * ------------------------------------------------------------------ */

export interface GenerateOptions {
  onProgress?: OnProgress;
  /** Overrides the GENERATION_MODE env var; mainly for tests. */
  mode?: "two-phase" | "single";
}

const resolveMode = (override?: GenerateOptions["mode"]) =>
  override ?? (process.env.GENERATION_MODE === "single" ? "single" : "two-phase");

export async function generateMindmap(
  text: string,
  options: GenerateOptions = {},
): Promise<Mindmap> {
  const source = assertUsableInput(text);
  const onProgress = options.onProgress ?? noop;

  onProgress({ phase: "accepted", message: "Input accepted" });

  const mindmap =
    resolveMode(options.mode) === "single"
      ? await generateSinglePass(source, onProgress)
      : await generateTwoPhase(source, onProgress);

  onProgress({ phase: "validated", message: `Validated ${mindmap.nodes.length} nodes` });
  return mindmap;
}

async function generateSinglePass(source: string, onProgress: OnProgress): Promise<Mindmap> {
  onProgress({ phase: "detail", message: "Generating mindmap" });
  return requestValidated({
    task: "single",
    prompt: singlePassPrompt(source),
    schema: MindmapSchema,
    context: { sourceText: source },
    onProgress,
  });
}

/**
 * Two-phase generation.
 *
 * Phase 1 asks only for the title, ids and labels. Phase 2 then writes the
 * summaries and connections against an id set that is already fixed — which is
 * what makes the dangling-edge and unknown-id failure modes structurally
 * unavailable rather than merely discouraged by the prompt. It also makes a
 * repair cheap: a phase-2 failure re-runs phase 2 only, never the outline.
 */
async function generateTwoPhase(source: string, onProgress: OnProgress): Promise<Mindmap> {
  onProgress({ phase: "outline", message: "Extracting outline" });

  const outline = await requestValidated({
    task: "outline",
    prompt: outlinePrompt(source),
    schema: OutlineSchema,
    context: { sourceText: source },
    onProgress,
  });

  onProgress({
    phase: "outline-ready",
    message: `Outline ready: ${outline.nodes.length} nodes`,
    outline,
  });
  onProgress({ phase: "detail", message: "Writing summaries and connections" });

  const outlineLabels = outline.nodes
    .map((n) => `- ${n.id}: ${n.label}${n.id === outline.rootId ? " (root)" : ""}`)
    .join("\n");

  const detail = await requestValidated({
    task: "detail",
    prompt: detailPrompt(source, outlineLabels),
    schema: detailSchemaFor(outline),
    context: { sourceText: source, outline },
    onProgress,
  });

  const summaryById = new Map(detail.summaries.map((s) => [s.id, s.summary]));

  // Belt and braces: assembled from two independently validated halves, then
  // validated once more as a whole.
  return MindmapSchema.parse({
    title: outline.title,
    rootId: outline.rootId,
    nodes: outline.nodes.map((node) => ({
      ...node,
      summary: summaryById.get(node.id) ?? "",
    })),
    connections: detail.connections,
  });
}

/** Phase-2 validation, narrowed to the ids phase 1 actually produced. */
function detailSchemaFor(outline: Outline) {
  const ids = new Set(outline.nodes.map((n) => n.id));

  return DetailSchema.refine(
    (detail) => outline.nodes.every((node) => detail.summaries.some((s) => s.id === node.id)),
    { message: "every outline node id must receive exactly one summary" },
  )
    .refine((detail) => detail.summaries.every((s) => ids.has(s.id)), {
      message: "a summary referenced a node id that is not in the outline",
    })
    .refine(
      (detail) => detail.connections.every((c) => ids.has(c.from) && ids.has(c.to)),
      { message: "a connection referenced a node id that is not in the outline" },
    )
    .refine((detail) => detail.connections.every((c) => c.from !== c.to), {
      message: "a connection must not point at its own node",
    })
    .refine(
      (detail) =>
        outline.nodes
          .filter((n) => n.id !== outline.rootId)
          .every((n) => detail.connections.some((c) => c.from === n.id || c.to === n.id)),
      { message: "every non-root node must appear in at least one connection" },
    );
}

/* ------------------------------------------------------------------ *
 * Stretch goal: drill-down expansion
 * ------------------------------------------------------------------ */

/**
 * Generate one deeper layer beneath a single node of an existing mindmap.
 *
 * Reuses the same untrusted-output boundary as the top-level generator; the
 * only difference is the validator, which is scoped to the map being expanded
 * so a new layer can never collide with or dangle off the existing graph.
 */
export async function expandNode(args: {
  mindmap: StoredMindmap;
  nodeId: string;
  sourceText?: string;
  onProgress?: OnProgress;
}): Promise<Expansion> {
  const { mindmap, nodeId, sourceText, onProgress = noop } = args;

  const parent = mindmap.nodes.find((n) => n.id === nodeId);
  if (!parent) {
    throw new InvalidInputError(`node "${nodeId}" does not exist in this mindmap`);
  }

  const existingIds = new Set(mindmap.nodes.map((n) => n.id));
  const idPrefix = uniqueIdPrefix(parent.id, existingIds);

  onProgress({ phase: "detail", message: `Expanding "${parent.label}"` });

  return requestValidated({
    task: "expansion",
    prompt: expansionPrompt({
      mindmapTitle: mindmap.title,
      parentLabel: parent.label,
      parentSummary: parent.summary,
      existingLabels: mindmap.nodes.map((n) => `- ${n.label}`).join("\n"),
      idPrefix,
      min: MIN_EXPANSION_NODES,
      max: MAX_EXPANSION_NODES,
      sourceText,
    }),
    schema: expansionSchemaFor(existingIds, parent.id),
    context: { sourceText: sourceText ?? "", parent, idPrefix },
    onProgress,
  });
}

/** `n5x`, or `n5x2x` if a previous expansion already claimed the shorter form. */
function uniqueIdPrefix(parentId: string, existingIds: Set<string>): string {
  let prefix = `${parentId}x`;
  while ([...existingIds].some((id) => id.startsWith(prefix))) prefix += "x";
  return prefix;
}

/** Expansion validation, scoped to the graph it is being merged into. */
function expansionSchemaFor(existingIds: Set<string>, parentId: string) {
  return ExpansionSchema.refine(
    (e) => new Set(e.nodes.map((n) => n.id)).size === e.nodes.length,
    { message: "new node ids must be unique" },
  )
    .refine((e) => e.nodes.every((n) => !existingIds.has(n.id)), {
      message: "new node ids must not collide with nodes already in the mindmap",
    })
    .refine(
      (e) => {
        const newIds = new Set(e.nodes.map((n) => n.id));
        return e.connections.every(
          (c) => (c.from === parentId || newIds.has(c.from)) && newIds.has(c.to),
        );
      },
      {
        message:
          "each connection must run from the expanded node or another new node, to a new node",
      },
    )
    .refine(
      (e) => e.nodes.every((n) => e.connections.some((c) => c.to === n.id)),
      { message: "every new node must be reachable by at least one connection" },
    );
}
