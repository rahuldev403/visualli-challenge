import type { Mindmap } from "../shared/types";

export const MOCK_MINDMAP: Mindmap = {
  title: "Photosynthesis Overview (MOCK)",
  rootId: "n1",
  nodes: [
    {
      id: "n1",
      label: "Photosynthesis",
      summary:
        "The process by which plants convert light energy into chemical energy.",
    },
    {
      id: "n2",
      label: "Light Energy",
      summary: "Solar radiation absorbed to power the photosynthetic reaction.",
    },
    {
      id: "n3",
      label: "Chlorophyll",
      summary:
        "The green pigment in plant leaves responsible for capturing sunlight.",
    },
    {
      id: "n4",
      label: "Water & CO2",
      summary: "The primary raw materials converted into organic compounds.",
    },
    {
      id: "n5",
      label: "Glucose",
      summary: "The sugar produced to store chemical energy for the organism.",
    },
    {
      id: "n6",
      label: "Oxygen",
      summary:
        "The byproduct released into the atmosphere that sustains aerobic life.",
    },
  ],
  connections: [
    { from: "n1", to: "n2", label: "harnesses" },
    { from: "n2", to: "n3", label: "captured by" },
    { from: "n1", to: "n4", label: "requires" },
    { from: "n1", to: "n5", label: "produces" },
    { from: "n1", to: "n6", label: "releases" },
  ],
};
