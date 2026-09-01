"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProvider = void 0;
exports.assertUsableInput = assertUsableInput;
exports.generateMindmap = generateMindmap;
exports.expandNode = expandNode;
const zod_1 = require("zod");
const types_1 = require("../shared/types");
const errors_1 = require("./errors");
const gemini_provider_1 = require("./gemini.provider");
const mock_provider_1 = require("./mock.provider");
const provider_1 = require("./provider");
const prompts_1 = require("./prompts");
const noop = () => { };
/* ------------------------------------------------------------------ *
 * Provider selection
 * ------------------------------------------------------------------ */
const mockProvider = new mock_provider_1.MockProvider();
const geminiProvider = new gemini_provider_1.GeminiProvider();
const resolveProvider = () => ((0, provider_1.isMockMode)() ? mockProvider : geminiProvider);
exports.resolveProvider = resolveProvider;
/* ------------------------------------------------------------------ *
 * The untrusted-output boundary
 * ------------------------------------------------------------------ */
/** JSON Schemas are derived once from the Zod schemas and reused. */
const jsonSchemaCache = new WeakMap();
const jsonSchemaFor = (schema) => {
    const cached = jsonSchemaCache.get(schema);
    if (cached)
        return cached;
    const generated = zod_1.z.toJSONSchema(schema, { io: "input" });
    jsonSchemaCache.set(schema, generated);
    return generated;
};
const formatIssues = (error) => error.issues.map((issue) => {
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
async function requestValidated(args) {
    const { task, prompt, schema, context = {}, onProgress = noop } = args;
    const provider = (0, exports.resolveProvider)();
    const jsonSchema = jsonSchemaFor(schema);
    const attempts = [];
    let currentPrompt = prompt;
    for (let attempt = 0; attempt <= 1; attempt++) {
        const raw = await provider.generateJson({
            task,
            prompt: currentPrompt,
            jsonSchema,
            context: { ...context, attempt },
        });
        attempts.push(raw);
        let issues;
        try {
            // Both failure modes land here: unparseable text, and text that parses
            // but breaks the contract. They are handled identically on purpose.
            const parsed = JSON.parse(raw);
            return schema.parse(parsed);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                issues = formatIssues(error);
            }
            else if (error instanceof SyntaxError) {
                issues = ["the response was not valid JSON"];
            }
            else {
                throw error;
            }
        }
        if (attempt === 0) {
            onProgress({
                phase: "repair",
                message: `Model output failed validation, retrying with corrections (${issues.length} issue${issues.length === 1 ? "" : "s"})`,
                issues,
            });
            currentPrompt = (0, prompts_1.repairPrompt)(prompt, raw, issues.map((i) => `- ${i}`).join("\n"));
            continue;
        }
        throw new errors_1.SchemaValidationError(`The model returned an invalid ${task} payload twice. Last errors: ${issues.join("; ")}`, attempts);
    }
    /* c8 ignore next */
    throw new errors_1.ProviderError("unreachable");
}
/* ------------------------------------------------------------------ *
 * Input guards
 * ------------------------------------------------------------------ */
/**
 * Rejected before a token is spent. Long input is refused outright rather than
 * silently truncated: quietly summarising half of someone's document and
 * presenting it as the whole thing is worse than a clear error.
 */
function assertUsableInput(text) {
    if (typeof text !== "string" || text.trim().length === 0) {
        throw new errors_1.InvalidInputError("text is required and must be a non-empty string");
    }
    const trimmed = text.trim();
    if (trimmed.length < types_1.MIN_INPUT_CHARS) {
        throw new errors_1.InvalidInputError(`text must be at least ${types_1.MIN_INPUT_CHARS} characters to summarise meaningfully (received ${trimmed.length})`);
    }
    if (trimmed.length > types_1.MAX_INPUT_CHARS) {
        throw new errors_1.InvalidInputError(`text must be at most ${types_1.MAX_INPUT_CHARS} characters (received ${trimmed.length}). Please trim the input or split it into sections.`);
    }
    return trimmed;
}
const resolveMode = (override) => override ?? (process.env.GENERATION_MODE === "single" ? "single" : "two-phase");
async function generateMindmap(text, options = {}) {
    const source = assertUsableInput(text);
    const onProgress = options.onProgress ?? noop;
    onProgress({ phase: "accepted", message: "Input accepted" });
    const mindmap = resolveMode(options.mode) === "single"
        ? await generateSinglePass(source, onProgress)
        : await generateTwoPhase(source, onProgress);
    onProgress({ phase: "validated", message: `Validated ${mindmap.nodes.length} nodes` });
    return mindmap;
}
async function generateSinglePass(source, onProgress) {
    onProgress({ phase: "detail", message: "Generating mindmap" });
    return requestValidated({
        task: "single",
        prompt: (0, prompts_1.singlePassPrompt)(source),
        schema: types_1.MindmapSchema,
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
async function generateTwoPhase(source, onProgress) {
    onProgress({ phase: "outline", message: "Extracting outline" });
    const outline = await requestValidated({
        task: "outline",
        prompt: (0, prompts_1.outlinePrompt)(source),
        schema: types_1.OutlineSchema,
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
        prompt: (0, prompts_1.detailPrompt)(source, outlineLabels),
        schema: detailSchemaFor(outline),
        context: { sourceText: source, outline },
        onProgress,
    });
    const summaryById = new Map(detail.summaries.map((s) => [s.id, s.summary]));
    // Belt and braces: assembled from two independently validated halves, then
    // validated once more as a whole.
    return types_1.MindmapSchema.parse({
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
function detailSchemaFor(outline) {
    const ids = new Set(outline.nodes.map((n) => n.id));
    return types_1.DetailSchema.refine((detail) => outline.nodes.every((node) => detail.summaries.some((s) => s.id === node.id)), { message: "every outline node id must receive exactly one summary" })
        .refine((detail) => detail.summaries.every((s) => ids.has(s.id)), {
        message: "a summary referenced a node id that is not in the outline",
    })
        .refine((detail) => detail.connections.every((c) => ids.has(c.from) && ids.has(c.to)), { message: "a connection referenced a node id that is not in the outline" })
        .refine((detail) => detail.connections.every((c) => c.from !== c.to), {
        message: "a connection must not point at its own node",
    })
        .refine((detail) => outline.nodes
        .filter((n) => n.id !== outline.rootId)
        .every((n) => detail.connections.some((c) => c.from === n.id || c.to === n.id)), { message: "every non-root node must appear in at least one connection" });
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
async function expandNode(args) {
    const { mindmap, nodeId, sourceText, onProgress = noop } = args;
    const parent = mindmap.nodes.find((n) => n.id === nodeId);
    if (!parent) {
        throw new errors_1.InvalidInputError(`node "${nodeId}" does not exist in this mindmap`);
    }
    const existingIds = new Set(mindmap.nodes.map((n) => n.id));
    const idPrefix = uniqueIdPrefix(parent.id, existingIds);
    onProgress({ phase: "detail", message: `Expanding "${parent.label}"` });
    return requestValidated({
        task: "expansion",
        prompt: (0, prompts_1.expansionPrompt)({
            mindmapTitle: mindmap.title,
            parentLabel: parent.label,
            parentSummary: parent.summary,
            existingLabels: mindmap.nodes.map((n) => `- ${n.label}`).join("\n"),
            idPrefix,
            min: types_1.MIN_EXPANSION_NODES,
            max: types_1.MAX_EXPANSION_NODES,
            sourceText,
        }),
        schema: expansionSchemaFor(existingIds, parent.id),
        context: { sourceText: sourceText ?? "", parent, idPrefix },
        onProgress,
    });
}
/** `n5x`, or `n5x2x` if a previous expansion already claimed the shorter form. */
function uniqueIdPrefix(parentId, existingIds) {
    let prefix = `${parentId}x`;
    while ([...existingIds].some((id) => id.startsWith(prefix)))
        prefix += "x";
    return prefix;
}
/** Expansion validation, scoped to the graph it is being merged into. */
function expansionSchemaFor(existingIds, parentId) {
    return types_1.ExpansionSchema.refine((e) => new Set(e.nodes.map((n) => n.id)).size === e.nodes.length, { message: "new node ids must be unique" })
        .refine((e) => e.nodes.every((n) => !existingIds.has(n.id)), {
        message: "new node ids must not collide with nodes already in the mindmap",
    })
        .refine((e) => {
        const newIds = new Set(e.nodes.map((n) => n.id));
        return e.connections.every((c) => (c.from === parentId || newIds.has(c.from)) && newIds.has(c.to));
    }, {
        message: "each connection must run from the expanded node or another new node, to a new node",
    })
        .refine((e) => e.nodes.every((n) => e.connections.some((c) => c.to === n.id)), { message: "every new node must be reachable by at least one connection" });
}
