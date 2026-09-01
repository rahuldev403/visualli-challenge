import { GoogleGenAI } from "@google/genai";
import { ProviderError } from "./errors";
import type { LlmProvider, LlmRequest } from "./provider";


const DEFAULT_MODEL = "gemini-2.5-flash";


export function sanitiseJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitiseJsonSchema);
  if (schema === null || typeof schema !== "object") return schema;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === "$schema" || key === "additionalProperties") continue;
    out[key] = sanitiseJsonSchema(value);
  }
  return out;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  private client: GoogleGenAI | undefined;

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        "GEMINI_API_KEY is not set. Set it in backend/.env, or run with MOCK_MODE=true to use canned fixtures.",
      );
    }
    // Built lazily so importing this module never requires a key — that is what
    // lets the test suite and mock mode run with no credentials present.
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client;
  }

  async generateJson(request: LlmRequest): Promise<string> {
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    let response;
    try {
      response = await this.getClient().models.generateContent({
        model,
        contents: request.prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: sanitiseJsonSchema(request.jsonSchema),
          temperature: 0.2,
        },
      });
    } catch (error) {
      throw new ProviderError(
        `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const text = response.text;
    if (!text) {
      // Usually a safety block or a hit token ceiling; either way there is no
      // JSON to validate, so this is a provider failure and not a schema one.
      throw new ProviderError(
        `Gemini returned an empty response (finishReason: ${
          response.candidates?.[0]?.finishReason ?? "unknown"
        })`,
      );
    }
    return text;
  }
}
