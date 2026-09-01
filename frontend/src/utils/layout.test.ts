import { describe, expect, it } from "vitest";
import { buildGraphElements, computePlacements, handleSidesFor } from "./layout";
import type { Mindmap } from "../types";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const baseMindmap = (overrides: Partial<Mindmap> = {}): Mindmap => ({
  id: "map-1",
  title: "How Photosynthesis Works",
  rootId: "n1",
  createdAt: "2026-09-01T10:00:00.000Z",
  expandedNodeIds: [],
  nodes: [
    { id: "n1", label: "Photosynthesis", summary: "The whole process." },
    { id: "n2", label: "Light Energy", summary: "Sunlight powers it." },
    { id: "n3", label: "Chlorophyll", summary: "The pigment that absorbs light." },
    { id: "n4", label: "Glucose", summary: "Sugar is produced." },
    { id: "n5", label: "Oxygen", summary: "Released as a by-product." },
  ],
  connections: [
    { from: "n1", to: "n2", label: "harnesses" },
    { from: "n1", to: "n3", label: "uses" },
    { from: "n1", to: "n4", label: "produces" },
    { from: "n1", to: "n5", label: "releases" },
  ],
  ...overrides,
});

describe("computePlacements", () => {
  it("anchors the root at the centre", () => {
    const placements = computePlacements(baseMindmap());

    expect(placements.get("n1")).toMatchObject({ x: 0, y: 0, depth: 0 });
  });

  it("arranges the root's children on a ring around it", () => {
    const placements = computePlacements(baseMindmap());
    const root = placements.get("n1")!;

    const radii = ["n2", "n3", "n4", "n5"].map((id) => distance(placements.get(id)!, root));

    // All four sit the same distance out...
    for (const radius of radii) {
      expect(radius).toBeCloseTo(radii[0]!, 5);
    }
    expect(radii[0]).toBeGreaterThan(0);

    // ...and they are spread apart rather than stacked on one another.
    const positions = ["n2", "n3", "n4", "n5"].map((id) => placements.get(id)!);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(distance(positions[i]!, positions[j]!)).toBeGreaterThan(50);
      }
    }
  });

  it("assigns depth by distance from the root", () => {
    const placements = computePlacements(baseMindmap());

    expect(placements.get("n1")!.depth).toBe(0);
    expect(placements.get("n2")!.depth).toBe(1);
  });

  it("places a drill-down layer beside its parent rather than back on the main ring", () => {
    const expanded = baseMindmap({
      expandedNodeIds: ["n4"],
      nodes: [
        ...baseMindmap().nodes,
        { id: "n4x1", label: "Starch Storage", summary: "Stored as starch." },
        { id: "n4x2", label: "Respiration", summary: "Broken down for energy." },
      ],
      connections: [
        ...baseMindmap().connections,
        { from: "n4", to: "n4x1", label: "stored as" },
        { from: "n4", to: "n4x2", label: "fuels" },
      ],
    });

    const placements = computePlacements(expanded);
    const root = placements.get("n1")!;
    const parent = placements.get("n4")!;

    for (const childId of ["n4x1", "n4x2"]) {
      const child = placements.get(childId)!;
      expect(child.depth).toBe(2);
      // The whole point of the nested layout: a child is nearer the node it was
      // generated from than it is to the centre of the map.
      expect(distance(child, parent)).toBeLessThan(distance(child, root));
    }
  });

  it("still places nodes the root cannot reach", () => {
    const orphaned = baseMindmap({
      nodes: [...baseMindmap().nodes, { id: "loose", label: "Loose End", summary: "Unlinked." }],
    });

    const placements = computePlacements(orphaned);

    expect(placements.has("loose")).toBe(true);
    expect(placements.get("loose")).not.toMatchObject({ x: 0, y: 0 });
  });

  it("returns nothing when the rootId matches no node", () => {
    const placements = computePlacements(baseMindmap({ rootId: "missing" }));

    expect(placements.size).toBe(0);
  });
});

describe("buildGraphElements", () => {
  it("produces one React Flow node per mindmap node and marks the root", () => {
    const { nodes } = buildGraphElements(baseMindmap());

    expect(nodes).toHaveLength(5);
    expect(nodes.find((n) => n.id === "n1")!.data.isRoot).toBe(true);
    expect(nodes.find((n) => n.id === "n2")!.data.isRoot).toBe(false);
  });

  it("routes each edge through the handles that face each other", () => {
    const { edges } = buildGraphElements(baseMindmap());

    // Every edge must name a real handle pair, or React Flow silently drops it.
    for (const edge of edges) {
      expect(edge.sourceHandle).toMatch(/^s-(top|right|bottom|left)$/);
      expect(edge.targetHandle).toMatch(/^t-(top|right|bottom|left)$/);
    }
  });

  it("renders one labelled edge per connection", () => {
    const { edges } = buildGraphElements(baseMindmap());

    expect(edges).toHaveLength(4);
    expect(edges.map((e) => e.label)).toContain("HARNESSES");
    expect(edges.every((e) => e.source && e.target)).toBe(true);
    // Edge ids must be unique or React Flow drops the duplicates.
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
  });

  it("keeps distinct ids for two connections between the same pair of nodes", () => {
    const duplicated = baseMindmap({
      connections: [
        { from: "n1", to: "n2", label: "harnesses" },
        { from: "n1", to: "n2", label: "also needs" },
      ],
    });

    const { edges } = buildGraphElements(duplicated);

    expect(new Set(edges.map((e) => e.id)).size).toBe(2);
  });

  it("flags nodes that have already been expanded", () => {
    const { nodes } = buildGraphElements(baseMindmap({ expandedNodeIds: ["n4"] }));

    expect(nodes.find((n) => n.id === "n4")!.data.isExpanded).toBe(true);
    expect(nodes.find((n) => n.id === "n2")!.data.isExpanded).toBe(false);
  });
});

describe("handleSidesFor", () => {
  it.each([
    ["to the right", { x: 200, y: 0 }, "right", "left"],
    ["to the left", { x: -200, y: 0 }, "left", "right"],
    ["below", { x: 0, y: 200 }, "bottom", "top"],
    ["above", { x: 0, y: -200 }, "top", "bottom"],
  ])("connects through the facing sides when the target is %s", (_name, to, source, target) => {
    expect(handleSidesFor({ x: 0, y: 0 }, to)).toEqual({ source, target });
  });
});
