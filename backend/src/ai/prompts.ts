import { MAX_NODES, MIN_NODES, MAX_LABEL_WORDS } from "../shared/types";

const RULES = `Rules you must follow:
- Produce between ${MIN_NODES} and ${MAX_NODES} nodes in total, including the root.
- Node ids must be short, stable and unique, in the form n1, n2, n3, ...
- Labels are ${MAX_LABEL_WORDS} words or fewer.
- The root node is the single central idea of the text.`;

export const outlinePrompt = (text: string) => `You turn prose into the skeleton of a mindmap.

Read the source text and identify its central idea and the ${MIN_NODES - 1} to ${MAX_NODES - 1} most
important supporting ideas. Return only the title, the root node id, and the nodes
with their labels. Do not write summaries yet.

${RULES}

Source text:
"""
${text}
"""`;

export const detailPrompt = (text: string, outlineLabels: string) => `You are completing a mindmap that has already been outlined.

These nodes are fixed. Do not invent new ids, rename them, or drop any of them:
${outlineLabels}

For every node id listed above, write a one-sentence summary grounded in the source
text. Then describe how the nodes relate, as directed connections.

Rules you must follow:
- Return exactly one summary per node id listed above, and no others.
- Every connection's "from" and "to" must be one of the ids listed above.
- A connection must never point at its own node.
- Connection labels are short relationship phrases such as "causes", "part of", "produces".
- The graph must be connected: every non-root node must appear in at least one connection.

Source text:
"""
${text}
"""`;

export const singlePassPrompt = (text: string) => `You turn prose into a structured mindmap.

Read the source text and produce a mindmap of its central idea and supporting ideas.

${RULES}
- Every node needs a one-sentence summary grounded in the source text.
- Every connection's "from" and "to" must reference ids you defined in "nodes".
- A connection must never point at its own node.
- Every non-root node must appear in at least one connection.

Source text:
"""
${text}
"""`;

export const expansionPrompt = (args: {
  mindmapTitle: string;
  parentLabel: string;
  parentSummary: string;
  existingLabels: string;
  idPrefix: string;
  min: number;
  max: number;
  sourceText?: string;
}) => `You are drilling one level deeper into a single node of an existing mindmap.

The mindmap is titled "${args.mindmapTitle}".
You are expanding the node "${args.parentLabel}" — ${args.parentSummary}

Nodes that already exist elsewhere in this mindmap (do not repeat these ideas):
${args.existingLabels}

Produce ${args.min} to ${args.max} new child ideas that break "${args.parentLabel}" down into
its constituent parts. Each child must be more specific than the parent.

Rules you must follow:
- Every new node id must start with "${args.idPrefix}" — for example ${args.idPrefix}1, ${args.idPrefix}2.
- Labels are ${MAX_LABEL_WORDS} words or fewer, and each needs a one-sentence summary.
- Return one connection per new node, with "from" set to the id you were given and
  "to" set to the new node's id.
- Do not restate the parent node itself as a child.${
  args.sourceText
    ? `

Source text the mindmap was built from:
"""
${args.sourceText}
"""`
    : ""
}`;

/**
 * The corrective retry. Rather than resending the identical prompt and hoping
 * for better luck, we hand the model its own failed output plus the exact
 * validator messages it violated.
 */
export const repairPrompt = (originalPrompt: string, rawOutput: string, issues: string) =>
  `${originalPrompt}

---

Your previous response was rejected by a strict validator.

Previous response:
${rawOutput}

Validation errors that must all be fixed:
${issues}

Return a corrected response that satisfies every rule above. Change only what is
necessary to fix these errors.`;
