"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis } from "./analysis";
import { initialListeningState, ListeningSession, type Recognition } from "./listeningSession";

export async function analyzeTranscript(transcript: string, signal?: AbortSignal): Promise<Analysis> {
  const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }), signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The scam check could not finish.");
  return data;
}
export function useListening(onVerdict: (verdict: Analysis) => void) {
  const [state, setState] = useState(initialListeningState);
  const session = useRef<ListeningSession>();
  const callback = useRef(onVerdict);
  useEffect(() => { callback.current = onVerdict; }, [onVerdict]);
  useEffect(() => {
    const speechWindow = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    const engine = new ListeningSession({
      getMedia: () => {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Recording unavailable");
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      },
      makeRecorder: stream => {
        const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
        return new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      },
      makeRecognition: SpeechRecognition ? () => new SpeechRecognition() : undefined,
      transcribe: async (audio, signal) => {
        const form = new FormData(); form.append("audio", audio, audio.type.includes("mp4") ? "recent-call.mp4" : "recent-call.webm");
        const response = await fetch("/api/transcribe", { method: "POST", body: form, signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Audio could not be checked. Protection stopped.");
        return data.transcript;
      },
      analyze: analyzeTranscript, update: setState, verdict: verdict => callback.current(verdict),
    });
    session.current = engine;
    // A frozen/closed page cannot offer reliable protection. Require a new start afterwards.
    const leaving = () => engine.stop("Page suspended. Start protection again when you return.");
    window.addEventListener("pagehide", leaving); document.addEventListener("freeze", leaving);
    return () => { window.removeEventListener("pagehide", leaving); document.removeEventListener("freeze", leaving); engine.stop(); };
  }, []);
  return { state, start: () => session.current?.start(), stop: () => session.current?.stop(), checkNow: () => session.current?.checkNow() };
}
