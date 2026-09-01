import type { Mindmap, MindmapSummary, ProgressEvent } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** An error the backend described. Carries its code so the UI can react to it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string = "UNKNOWN",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_MESSAGE =
  "Could not reach the backend. Is it running on " + API_BASE + "?";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, "NETWORK_ERROR");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      body?.error ?? `Request failed with status ${response.status}`,
      body?.code ?? "HTTP_ERROR",
    );
  }
  return body as T;
}

export const listMindmaps = () => request<MindmapSummary[]>("/api/mindmaps");

export const getMindmap = (id: string) => request<Mindmap>(`/api/mindmaps/${id}`);

/** Drill one level deeper into a node. Returns the whole updated mindmap. */
export const expandMindmapNode = (id: string, nodeId: string) =>
  request<Mindmap>(`/api/mindmaps/${id}/expand`, {
    method: "POST",
    body: JSON.stringify({ nodeId }),
  });

/** Non-streaming fallback, kept because it is the endpoint the brief specifies. */
export const createMindmap = (text: string) =>
  request<Mindmap>("/api/mindmaps", {
    method: "POST",
    body: JSON.stringify({ text }),
  });

interface SsePacket {
  event: string;
  data: unknown;
}

/** Parses the `event:`/`data:` pairs out of one complete SSE frame. */
function parseFrame(frame: string): SsePacket | null {
  const event = /^event: (.*)$/m.exec(frame)?.[1];
  const data = /^data: (.*)$/m.exec(frame)?.[1];
  if (!event || !data) return null;

  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

/**
 * Streaming create.
 *
 * `EventSource` only speaks GET, and the source text belongs in a body rather
 * than a query string, so the SSE frames are read off the fetch response
 * directly. Progress events land as they happen; the mindmap resolves at the
 * end.
 */
export async function streamMindmap(
  text: string,
  options: { onProgress?: (event: ProgressEvent) => void; signal?: AbortSignal } = {},
): Promise<Mindmap> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/mindmaps/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_MESSAGE, "NETWORK_ERROR");
  }

  // Validation failures are rejected before the stream opens, as normal JSON.
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error ?? `Request failed with status ${response.status}`,
      body?.code ?? "HTTP_ERROR",
    );
  }

  if (!response.body) {
    throw new ApiError("The server returned an empty stream.", "EMPTY_STREAM");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Mindmap | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line; the trailing partial frame stays
      // in the buffer until the rest of it arrives.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const packet = parseFrame(frame);
        if (!packet) continue;

        if (packet.event === "progress") {
          options.onProgress?.(packet.data as ProgressEvent);
        } else if (packet.event === "result") {
          result = packet.data as Mindmap;
        } else if (packet.event === "error") {
          const { error, code } = packet.data as { error: string; code: string };
          throw new ApiError(error, code);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw new ApiError(
      "The server closed the connection before returning a mindmap.",
      "INCOMPLETE_STREAM",
    );
  }
  return result;
}
