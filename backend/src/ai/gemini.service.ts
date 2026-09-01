import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import { MindmapSchema, Mindmap } from "../shared/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const geminiJsonSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    rootId: { type: SchemaType.STRING },
    nodes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: "Stable identifier (e.g. n1)",
          },
          label: { type: SchemaType.STRING, description: "1-4 words" },
          summary: {
            type: SchemaType.STRING,
            description: "One sentence summary",
          },
        },
        required: ["id", "label", "summary"],
      },
    },
    connections: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          from: { type: SchemaType.STRING, description: "Origin node ID" },
          to: { type: SchemaType.STRING, description: "Destination node ID" },
          label: { type: SchemaType.STRING, description: "Relationship label" },
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
      model: "gemini-3.6-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiJsonSchema,
        temperature: 0.2,
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
      throw new Error(
        `Failed to generate a logically valid mindmap from LLM. ->${error}`,
      );
    }
  }
}
