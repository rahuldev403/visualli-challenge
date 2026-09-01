"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
exports.sanitiseJsonSchema = sanitiseJsonSchema;
const genai_1 = require("@google/genai");
const errors_1 = require("./errors");
const DEFAULT_MODEL = "gemini-3.6-flash";
function sanitiseJsonSchema(schema) {
    if (Array.isArray(schema))
        return schema.map(sanitiseJsonSchema);
    if (schema === null || typeof schema !== "object")
        return schema;
    const out = {};
    for (const [key, value] of Object.entries(schema)) {
        if (key === "$schema" || key === "additionalProperties")
            continue;
        out[key] = sanitiseJsonSchema(value);
    }
    return out;
}
class GeminiProvider {
    name = "gemini";
    client;
    getClient() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new errors_1.ProviderError("GEMINI_API_KEY is not set. Set it in backend/.env, or run with MOCK_MODE=true to use canned fixtures.");
        }
        // Built lazily so importing this module never requires a key — that is what
        // lets the test suite and mock mode run with no credentials present.
        this.client ??= new genai_1.GoogleGenAI({ apiKey });
        return this.client;
    }
    async generateJson(request) {
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
        }
        catch (error) {
            throw new errors_1.ProviderError(`Gemini request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        const text = response.text;
        if (!text) {
            // Usually a safety block or a hit token ceiling; either way there is no
            // JSON to validate, so this is a provider failure and not a schema one.
            throw new errors_1.ProviderError(`Gemini returned an empty response (finishReason: ${response.candidates?.[0]?.finishReason ?? "unknown"})`);
        }
        return text;
    }
}
exports.GeminiProvider = GeminiProvider;
