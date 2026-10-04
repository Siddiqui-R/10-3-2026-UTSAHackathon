"use client";
import { useEffect, useRef, useState } from "react";
import type { Analysis } from "./analysis";
import { initialListeningState, ListeningSession, type Recognition } from "./listeningSession";

export async function analyzeTranscript(transcript: string, signal?: AbortSignal): Promise<Analysis> {
  const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The scam check could not finish.");
  return data;
}
type WakeLock = { release(): Promise<void>; released: boolean };
export function useListening(onVerdict: (verdict: Analysis) => void) {
  const [state, setState] = useState(initialListeningState);
  const [awake, setAwake] = useState<"held" | "unsupported" | "off">("off");
  const session = useRef<ListeningSession>();
  const callback = useRef(onVerdict);
  const wakeLock = useRef<WakeLock | null>(null);
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
      makeLevelMeter: stream => {
        const context = new AudioContext();
        const analyser = context.createAnalyser(); analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        return {
          level: () => { analyser.getFloatTimeDomainData(samples); return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length); },
          close: () => { void context.close(); },
        };
      },
      transcribe: async (audio, signal) => {
        const form = new FormData(); form.append("audio", audio, audio.type.includes("mp4") ? "recent-call.mp4" : "recent-call.webm");
        const response = await fetch("/api/transcribe", { method: "POST", body: form, signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Audio could not be checked.");
        return data.transcript;
      },
      analyze: analyzeTranscript, update: setState, verdict: verdict => callback.current(verdict),
    });
    session.current = engine;
    engine.setOnline(navigator.onLine);
    const online = () => engine.setOnline(true); const offline = () => engine.setOnline(false);
    // A frozen/closed page cannot offer reliable protection. Require a new start afterwards.
    const leaving = () => engine.stop("Page closed or suspended, so protection stopped. Start it again when you return.");
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    window.addEventListener("pagehide", leaving); document.addEventListener("freeze", leaving);
    return () => {
      window.removeEventListener("online", online); window.removeEventListener("offline", offline);
      window.removeEventListener("pagehide", leaving); document.removeEventListener("freeze", leaving); engine.stop();
    };
  }, []);
  // Keep the screen awake while listening; browsers release the lock when the tab is hidden, so re-request on return.
  const listening = ["starting", "listening", "checking"].includes(state.status);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLock> } };
    if (!listening) { void wakeLock.current?.release().catch(() => {}); wakeLock.current = null; setAwake("off"); return; }
    if (!nav.wakeLock) { setAwake("unsupported"); return; }
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (wakeLock.current && !wakeLock.current.released)) return;
      try { const lock = await nav.wakeLock!.request("screen"); if (cancelled) void lock.release(); else { wakeLock.current = lock; setAwake("held"); } }
      catch { if (!cancelled) setAwake("unsupported"); }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", acquire); };
  }, [listening]);
  return {
    state, awake, start: () => session.current?.start(), stop: () => session.current?.stop(), checkNow: () => session.current?.checkNow(),
    holdTriggers: (ms: number) => session.current?.holdTriggers(ms),
  };
}
