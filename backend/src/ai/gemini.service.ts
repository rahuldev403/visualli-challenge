import { GoogleGenerativeAI, Schema, Type } from "@google/generative-ai";
import { MindmapSchema, Mindmap } from "../shared/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Map our needs to Gemini's JSON schema type
const geminiJsonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    rootId: { type: Type.STRING },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Stable identifier (e.g. n1)" },
          label: { type: Type.STRING, description: "1-4 words" },
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
          from: { type: Type.STRING, description: "Origin node ID" },
          to: { type: Type.STRING, description: "Destination node ID" },
          label: { type: Type.STRING, description: "Relationship label" },
        },
        required: ["from", "to", "label"],
      },
    },
  },
  required: ["title", "rootId", "nodes", "connections"],
};

export class GeminiService {
  static async generateMindmap(text: string, retries = 1): Promise<Mindmap> {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.7-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiJsonSchema,
        temperature: 0.2, // Keep creativity low, we want analytical accuracy
      },
    });

    try {
      const prompt = `You are a system that converts text into structured mindmaps.
      Extract a mindmap consisting of 5 to 9 nodes from the following text. 
      Text: "${text}"`;

      const result = await model.generateContent(prompt);

      const parsedData = JSON.parse(result.response.text());

      return MindmapSchema.parse(parsedData);
    } catch (error) {
      if (retries > 0) {
        console.warn(
          `Validation failed, logic hallucination detected. Retrying...`,
        );
        return this.generateMindmap(text, retries - 1);
      }
      throw new Error("Failed to generate a logically valid mindmap from LLM.");
    }
  }
}
