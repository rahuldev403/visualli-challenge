import type { Outline } from "../shared/types";

export type LlmTask = "outline" | "detail" | "single" | "expansion";

/**
 * Extra context carried alongside the prompt. Only the mock provider reads it —
 * a real provider gets everything it needs from `prompt` and `jsonSchema`.
 */
export interface GenerationContext {
  sourceText?: string;
  outline?: Outline;
  parent?: { id: string; label: string; summary: string };
  idPrefix?: string;
  /** 0 on the first call, 1 on the corrective retry. */
  attempt?: number;
}

export interface LlmRequest {
  task: LlmTask;
  prompt: string;
  /** JSON Schema derived from our Zod schema and sent as the structured-output contract. */
  jsonSchema: unknown;
  context?: GenerationContext;
}

/**
 * The seam between "we asked a model for something" and "we decided whether to
 * believe it". Providers return the raw response body and nothing else — every
 * provider is treated as returning untrusted text, so parsing and validation
 * live in one place in the generator.
 */
export interface LlmProvider {
  readonly name: string;
  generateJson(request: LlmRequest): Promise<string>;
}

export const isMockMode = () => process.env.MOCK_MODE === "true";
