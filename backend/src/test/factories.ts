import type { Mindmap } from "../shared/types";

export const SOURCE_TEXT =
  "Photosynthesis lets plants turn sunlight into sugar. Chlorophyll in the leaves absorbs " +
  "light energy. Water and carbon dioxide are consumed as raw inputs. Glucose is produced " +
  "and stored, while oxygen is released as a by-product.";

/** A mindmap that satisfies every rule in MindmapSchema. */
export const validMindmap = (): Mindmap => ({
  title: "How Photosynthesis Works",
  rootId: "n1",
  nodes: [
    { id: "n1", label: "Photosynthesis", summary: "Plants convert light into chemical energy." },
    { id: "n2", label: "Light Energy", summary: "Sunlight powers the reaction." },
    { id: "n3", label: "Chlorophyll", summary: "The pigment that absorbs the light." },
    { id: "n4", label: "Raw Inputs", summary: "Water and carbon dioxide are consumed." },
    { id: "n5", label: "Glucose", summary: "Sugar is produced and stored." },
  ],
  connections: [
    { from: "n1", to: "n2", label: "harnesses" },
    { from: "n1", to: "n3", label: "uses" },
    { from: "n1", to: "n4", label: "consumes" },
    { from: "n1", to: "n5", label: "produces" },
  ],
});

/**
 * The failure modes real models actually produce: a root that points nowhere,
 * a duplicated id, an edge to a node that was never defined, and a self-loop.
 */
export const invalidMindmap = () => ({
  title: "Broken",
  rootId: "missing-root",
  nodes: [
    { id: "n1", label: "First", summary: "Fine." },
    { id: "n1", label: "Duplicate", summary: "Shares an id with the node above." },
    { id: "n3", label: "Third", summary: "Fine." },
    { id: "n4", label: "Fourth", summary: "Fine." },
    { id: "n5", label: "Fifth", summary: "Fine." },
  ],
  connections: [
    { from: "n1", to: "ghost", label: "dangling" },
    { from: "n3", to: "n3", label: "self loop" },
  ],
});
