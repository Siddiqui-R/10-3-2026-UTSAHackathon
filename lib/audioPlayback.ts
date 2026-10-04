"use client";
import { speakWithDeviceVoice } from "./deviceVoice";
/** Fixed lines in the canary's ElevenLabs voice ("greeting", "goodbye"). Returns an object URL to revoke later. */
export async function fetchVoice(script: "greeting" | "goodbye") {
  const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script }) });
  if (!response.ok) throw new Error("voice unavailable");
  return URL.createObjectURL(await response.blob());
}
/** Play a recording; falls back to the device voice reading `text`. Resolves when it finishes or is paused. */
export function playAudio(url: string | undefined, text: string, onPlayer?: (audio: HTMLAudioElement) => void) {
  return new Promise<void>(resolve => {
    const viaDevice = () => { if (!speakWithDeviceVoice(text, { onStart: () => {}, onEnd: () => resolve(), onError: () => resolve() })) resolve(); };
    if (!url) { viaDevice(); return; }
    const audio = new Audio(url); onPlayer?.(audio);
    audio.onended = () => resolve(); audio.onerror = viaDevice; audio.onpause = () => { if (!audio.ended) resolve(); };
    audio.play().catch(viaDevice);
  });
}
