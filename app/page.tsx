"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Headphones, LockKeyhole, Phone, Shield, ShieldCheck } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import { demoTranscripts, WARNING_SCRIPT } from "@/lib/demoTranscripts";
import RiskMeter from "@/components/RiskMeter";
import WarningTakeover from "@/components/WarningTakeover";

type Phase = "idle" | "recording" | "analyzing" | "verdict";
export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("Checking for warning signs");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    if (!audioUrl) return;
    return () => { URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (deadline.current) clearTimeout(deadline.current);
    if (recorder.current) recorder.current.onstop = null;
    stream.current?.getTracks().forEach(track => track.stop());
    request.current?.abort();
  }, []);
  function clearTimers() {
    if (timer.current) clearInterval(timer.current);
    if (deadline.current) clearTimeout(deadline.current);
    timer.current = null; deadline.current = null;
  }
  function reset() {
    request.current?.abort();
    setPhase("idle"); setResult(null); setError(""); setAudioUrl(""); setAudioError(false);
    setSeconds(0); setBusy(false); setDemoOpen(false); lock.current = false;
  }
  async function prepareWarning(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: WARNING_SCRIPT }), signal });
      if (!response.ok) throw new Error("Speech unavailable");
      const blob = await response.blob();
      if (!signal?.aborted) setAudioUrl(URL.createObjectURL(blob));
    } catch { if (!signal?.aborted) setAudioError(true); }
  }
  async function analyze(transcript: string, controller: AbortController) {
    setStage("Checking for warning signs");
    const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }), signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "We could not finish checking this call.");
    if (controller.signal.aborted) return;
    setResult(data); setPhase("verdict");
    if (data.level === "scam") void prepareWarning(controller.signal);
  }
  async function demo(type: keyof typeof demoTranscripts) {
    if (lock.current) return;
    lock.current = true; setError(""); setResult(null); setAudioUrl(""); setAudioError(false); setPhase("analyzing");
    const controller = new AbortController(); request.current = controller;
    try { await analyze(demoTranscripts[type], controller); }
    catch (cause) { if (!controller.signal.aborted) { setPhase("idle"); setError(cause instanceof Error ? cause.message : "Please try again."); } }
    finally { lock.current = false; }
  }
  async function processAudio(blob: Blob) {
    setPhase("analyzing"); setStage("Listening to the words");
    const controller = new AbortController(); request.current = controller;
    try {
      if (!blob.size) throw new Error("We could not hear any audio. Try a demo below.");
      if (blob.size > 4 * 1024 * 1024) throw new Error("That recording is too large. Record a shorter call or try a demo.");
      const form = new FormData();
      form.append("audio", blob, blob.type.includes("mp4") ? "call.mp4" : blob.type.includes("ogg") ? "call.ogg" : "call.webm");
      const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not transcribe — try a demo below.");
      await analyze(data.transcript, controller);
    } catch (cause) {
      if (!controller.signal.aborted) { setPhase("idle"); setDemoOpen(true); setError(cause instanceof Error ? cause.message : "Please try a demo below."); }
    } finally { lock.current = false; }
  }
  async function startRecording() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setResult(null); setAudioUrl(""); setAudioError(false); setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Recording is unavailable. Please try one of the demos below.");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = mic;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(mic, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      recorder.current = capture;
      const chunks: BlobPart[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => {
        capture.onstop = null; clearTimers(); mic.getTracks().forEach(track => track.stop());
        lock.current = false; setPhase("idle"); setDemoOpen(true); setError("The recording stopped unexpectedly. Please try a demo.");
      };
      capture.onstop = () => {
        clearTimers(); mic.getTracks().forEach(track => track.stop()); stream.current = null;
        void processAudio(new Blob(chunks, { type: capture.mimeType || "audio/webm" }));
      };
      capture.start(1000); setPhase("recording");
      timer.current = setInterval(() => setSeconds(value => value + 1), 1000);
      deadline.current = setTimeout(stopRecording, 120_000);
    } catch {
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
      lock.current = false; setDemoOpen(true);
      setError("We could not access your microphone. Allow it in your browser, or try a demo below.");
    } finally { setBusy(false); }
  }
  function stopRecording() {
    clearTimers();
    if (recorder.current?.state === "recording") { setPhase("analyzing"); recorder.current.stop(); }
  }

  if (phase === "verdict" && result?.level === "scam") return <WarningTakeover result={result}
    audioUrl={audioUrl} audioError={audioError} onRetry={() => void prepareWarning(request.current?.signal)} onReset={reset} />;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={28} /></div><span>CallCanary</span></div>
      <div className="privacy-note"><LockKeyhole size={18} /><span>Here to help you stay safe</span></div>
    </header>
    <section className="home-content">
      <div className="intro-copy"><p className="eyebrow">Your canary in the coal mine for phone scams.</p>
        <h1>Not sure about a call?</h1><p className="intro-subtitle">Put the call on speaker. Let CallCanary listen and help.</p></div>
      <section className={`phone-panel ${phase === "recording" ? "is-recording" : ""}`} aria-label="CallCanary call checker">
        <div className="phone-earpiece" aria-hidden="true" />
        <div className="phone-screen">
          <div className="phone-status"><span>CALLCANARY</span><span className="status-dot" /><span>{phase === "idle" ? "READY" : phase.toUpperCase()}</span></div>
          <div className={`shield-art ${phase === "recording" ? "listening" : ""}`} aria-hidden="true"><div className="shield-ring"><Shield size={78} /><span><Check size={32} /></span></div></div>
          <div className="phone-copy" aria-live="polite">
            {phase === "recording" ? <><h2>Listening to your call</h2><p>Tap Hang Up to check what was said.</p></> :
              phase === "analyzing" ? <><h2>{stage}</h2><p>Please wait a few seconds.</p></> :
              phase === "verdict" && result ? <><h2 className={`result-title ${result.level === "safe" ? "safe" : "caution"}`}>{result.level === "safe" ? "This call looks safe." : "Be careful — this call shows warning signs."}</h2></> :
              <><h2>You are in control</h2><p>Tap below to check a suspicious call.</p></>}
          </div>
          {phase === "recording" && <div className="recording-time" role="timer">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>}
          {phase === "analyzing" && <div className="loading-bar" aria-label="Analysis in progress"><span /></div>}
          {(phase === "analyzing" || phase === "verdict") && <RiskMeter score={result?.risk_score ?? null} />}
          {phase === "idle" && <button className="answer-button" disabled={busy} onClick={() => void startRecording()}><Phone size={28} />{busy ? "Opening microphone…" : "Answer & Record"}</button>}
          {phase === "recording" && <button className="hangup-button" onClick={stopRecording}><Phone size={28} />Hang Up</button>}
          {phase === "verdict" && <button className="again-button" onClick={reset}>Check another call</button>}
          <p className="recording-limit">Stops automatically after 2 minutes</p>
        </div><div className="phone-home-indicator" aria-hidden="true" />
      </section>
      {error && <div className="error-message" role="alert"><AlertTriangle size={24} /><p>{error}</p></div>}
      {phase === "verdict" && result && <section className={`result-panel ${result.level === "safe" ? "safe" : "caution"}`} aria-label="Why we reached this result">
        <h2>{result.level === "safe" ? "No clear scam signals" : "Stay cautious"}</h2><ul>{result.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
      </section>}
      {phase === "idle" && <details className="demo-panel" open={demoOpen} onToggle={event => setDemoOpen(event.currentTarget.open)}>
        <summary>Try a demo call</summary><p>No microphone needed. Pick an example:</p>
        <div className="demo-buttons"><button disabled={busy} onClick={() => void demo("irs")}>Play IRS scam</button><button disabled={busy} onClick={() => void demo("romance")}>Play romance scam</button><button disabled={busy} onClick={() => void demo("phishing")}>Play phishing text</button></div>
      </details>}
      <p className="support-line"><Headphones size={22} />If you feel unsafe, hang up and call someone you trust.</p>
    </section>
    <footer className="footer-note">Audio is sent to ElevenLabs for transcription. Words are checked by Google Gemini.<br />CallCanary can miss scams. When in doubt, do not send money or share personal information.</footer>
  </main>;
}

