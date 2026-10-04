"use client";
import type { ScreenLayer, ScreenResult } from "./screening";
export type ScreenProgress = { transcript: string | null; layers: ScreenLayer[] };
/** POST a reply to /api/screen and follow its streamed progress until the final result. */
export async function runScreen(form: FormData, onProgress: (progress: ScreenProgress) => void): Promise<ScreenResult> {
  const response = await fetch("/api/screen", { method: "POST", body: form });
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "The screen could not finish.");
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let buffer = ""; let result: ScreenResult | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "progress") onProgress({ transcript: event.transcript, layers: event.layers });
    else if (event.type === "result") result = event.result;
    else if (event.type === "error") throw new Error(event.error);
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n"); buffer = lines.pop() || "";
    lines.forEach(handle);
    if (done) { handle(buffer); break; }
  }
  if (!result) throw new Error("The screen could not finish.");
  return result;
}
