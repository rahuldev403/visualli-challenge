import { Mindmap, MindmapSchema } from "./../../../packages/shared/types";
import { GoogleGenerativeAI, Schema, Type } from "@google/generative-ai";
import { Mindmap } from "../../../packages/shared/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateMindmap(
  text: string,
  retries = 1,
): Promise<Mindmap> {
  if (!text || text.trim().length < 20) {
    throw new Error("Input is too short to generate a meaningful mindmap.");
  }
  if (text.length > 30000) {
    throw new Error("Input exceeds maximum length limits.");
  }

  if (process.env.MOCK_MODE === "true") {
    return new Promise((resolve) =>
      setTimeout(() => resolve(MOCK_MINDMAP), 1500),
    );
  }

  const jsonSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      rootId: { type: Type.STRING },
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "Stable and unique identifier",
            },
            label: { type: Type.STRING, description: "1-4 words max" },
            summary: { type: Type.STRING, description: "One sentence summary" },
          },
          required: ["id", "label", "summary"],
        },
      },
      connections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            from: { type: Type.STRING, description: "ID of the origin node" },
            to: {
              type: Type.STRING,
              description: "ID of the destination node",
            },
            label: { type: Type.STRING, description: "Relationship label" },
          },
          required: ["from", "to", "label"],
        },
      },
    },
    required: ["title", "rootId", "nodes", "connections"],
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-3.7-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
      temperature: 0.2, // Low temperature for deterministic analysis
    },
  });

  try {
    const prompt = `You are an expert analyst. Extract a structured mindmap from the following text. 
    You must return exactly 5 to 9 nodes. 
    The rootId must exactly match one of the node IDs. 
    Connections must only use IDs that exist in your nodes array.
    
    TEXT TO ANALYZE: ${text}`;

    const result = await model.generateContent(prompt);

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return MindmapSchema.parse(parsedData);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Validation failed. Retrying... (${retries} left)`, error);
      return generateMindmap(text, retries - 1);
    }
    throw new Error("Failed to generate a valid mindmap after retries.");
  }
}
