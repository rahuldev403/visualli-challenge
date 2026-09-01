import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { MindmapSchema, Mindmap } from "../../../packages/shared/types";
import { MOCK_MINDMAP } from "./mockData";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateMindmap(
  text: string,
  retries = 1,
): Promise<Mindmap> {
  // 1. Edge Cases
  if (!text || text.trim().length < 20) {
    throw new Error("Input is too short to generate a meaningful mindmap.");
  }
  if (text.length > 30000) {
    throw new Error("Input exceeds maximum length token limits.");
  }

  // 2. Mock Mode
  if (process.env.MOCK_MODE === "true") {
    return new Promise((resolve) =>
      setTimeout(() => resolve(MOCK_MINDMAP), 1500),
    );
  }

  // 3. AI Generation & Validation
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert analyst. Extract a structured mindmap from the following text. You must return exactly 5 to 9 nodes. The rootId must exactly match one of the node IDs. Connections must only use IDs that exist in your nodes array.",
        },
        { role: "user", content: text },
      ],
      response_format: zodResponseFormat(MindmapSchema, "mindmap"),
      temperature: 0.2,
    });

    const parsedData = completion.choices[0].message.parsed;

    // Enforce cross-field validation (Zod .refine constraints)
    return MindmapSchema.parse(parsedData);
  } catch (error) {
    // 4. Corrective Retry Logic
    if (retries > 0) {
      console.warn(`Validation failed. Retrying... (${retries} left)`, error);
      return generateMindmap(text, retries - 1);
    }
    throw new Error("Failed to generate a valid mindmap after retries.");
  }
}
