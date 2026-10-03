"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Mic, MicOff, ShieldCheck } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import { demoTranscripts } from "@/lib/demoTranscripts";
import { scoreSignals, SIGNAL_THRESHOLD } from "@/lib/scamSignals";
import { analyzeTranscript, useListening } from "@/lib/useListening";
import RiskMeter from "@/components/RiskMeter";
import WarningTakeover from "@/components/WarningTakeover";
import Mascot from "@/components/Mascot";

type Health = { transcription: boolean; analysis: boolean; voice: boolean; ready: boolean };
export default function Home() {
  const [result, setResult] = useState<Analysis | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState(false);
  const [error, setError] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoSignals, setDemoSignals] = useState<ReturnType<typeof scoreSignals> | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [consented, setConsented] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const startRequest = useRef<AbortController>();
  const speechRequest = useRef<AbortController>();
  const demoRequest = useRef<AbortController>();
  const demoLock = useRef(false);
  const session = useListening(handleVerdict);

  async function prepareWarning(verdict: Analysis) {
    speechRequest.current?.abort();
    const controller = new AbortController(); speechRequest.current = controller;
    setAudioError(false);
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons: verdict.reasons.slice(0, 3) }), signal: controller.signal });
      if (!response.ok) throw new Error("Voice unavailable");
      const blob = await response.blob();
      if (!controller.signal.aborted) setAudioUrl(URL.createObjectURL(blob));
    } catch { if (!controller.signal.aborted) setAudioError(true); }
  }
  function handleVerdict(verdict: Analysis) {
    setResult(verdict);
    if (verdict.level === "scam") void prepareWarning(verdict);
  }
  useEffect(() => { if (audioUrl) return () => URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal }).then(response => response.json()).then(setHealth).catch(() => {});
    return () => { controller.abort(); startRequest.current?.abort(); speechRequest.current?.abort(); demoRequest.current?.abort(); };
  }, []);
  function reset() {
    session.stop(); startRequest.current?.abort(); speechRequest.current?.abort(); demoRequest.current?.abort(); setStarting(false);
    setResult(null); setAudioUrl(""); setAudioError(false); setError(""); setDemoSignals(null); setDemoBusy(false); demoLock.current = false;
  }
  async function start() {
    if (startRequest.current && !startRequest.current.signal.aborted) return;
    reset();
    const controller = new AbortController(); startRequest.current = controller; setStarting(true);
    try {
      const response = await fetch("/api/health", { signal: controller.signal });
      if (!response.ok) throw new Error("Could not check the provider connections.");
      const connected: Health = await response.json(); setHealth(connected);
      if (controller.signal.aborted) return;
      if (!connected.transcription || !connected.analysis) {
        setError("Connect ElevenLabs and Gemini first so CallCanary can verify what it hears."); return;
      }
      await session.start();
    } catch { if (!controller.signal.aborted) setError("Connection check failed. Please try again."); }
    finally { if (startRequest.current === controller) { startRequest.current = undefined; setStarting(false); } }
  }
  async function demo(type: keyof typeof demoTranscripts) {
    if (demoLock.current) return;
    session.stop(); startRequest.current?.abort(); setStarting(false); speechRequest.current?.abort(); setAudioUrl(""); setAudioError(false); setError(""); setResult(null);
    demoLock.current = true; setDemoBusy(true); setDemoSignals(scoreSignals(demoTranscripts[type]));
    const controller = new AbortController(); demoRequest.current = controller;
    try {
      const verdict = await analyzeTranscript(demoTranscripts[type], controller.signal);
      if (!controller.signal.aborted) handleVerdict(verdict);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The demo could not finish."); }
    finally { if (demoRequest.current === controller) { demoLock.current = false; setDemoBusy(false); } }
  }
  const active = ["starting", "listening", "checking"].includes(session.state.status);
  const signals = demoBusy ? demoSignals?.signals || [] : session.state.signals;
  const score = demoBusy ? demoSignals?.score || 0 : session.state.score;

  if (result?.level === "scam") return <WarningTakeover result={result} audioUrl={audioUrl} audioError={audioError}
    onRetry={() => void prepareWarning(result)} onReset={reset} />;

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><ShieldCheck size={28} /></div>CallCanary</div>
      <span className={`connection-pill ${health?.ready ? "connected" : ""}`}>{health === null ? "Checking connections…" : health.ready ? "Providers configured" : "Setup needed"}</span></header>
    <section className="home-content monitor-content">
      <div className="intro-copy"><p className="eyebrow">Your canary in the coal mine for phone scams.</p>
        <h1>A little bird. A big warning.</h1><p className="intro-subtitle">Turn on protection. Put your call on speaker. I&apos;ll listen for trouble.</p></div>
      {health && !health.ready && <details className="setup-card"><summary>Connect CallCanary to its voice and safety check</summary>
        <p>Set the missing variables in <code>.env.local</code> and in Vercel, then restart or redeploy.</p>
        <ul><li>ElevenLabs transcription: {health.transcription ? "SET" : "NOT SET"} — <code>ELEVENLABS_API_KEY</code></li>
          <li>Gemini scam analysis: {health.analysis ? "SET" : "NOT SET"} — <code>GEMINI_API_KEY</code></li>
          <li>Mascot voice: {health.voice ? "SET" : "NOT SET"} — <code>ELEVENLABS_VOICE_ID</code> or <code>ELEVENLABS_MASCOT_VOICE_ID</code></li></ul>
        <p><a href="https://elevenlabs.io/app/developers/api-keys" target="_blank" rel="noreferrer">ElevenLabs API keys</a> · <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">Google AI Studio keys</a>. Keep key values out of chat and Git.</p>
      </details>}
      <section className={`monitor-card ${active ? "monitor-active" : ""}`} aria-label="Continuous call protection">
        <div className="monitor-status"><span className={active ? "live-dot" : "off-dot"} />{demoBusy ? "CHECKING EXAMPLE" : session.state.status.toUpperCase()}</div>
        <Mascot />
        <div className="mascot-bubble" aria-live="polite"><h2>{demoBusy ? "Those words sound concerning…" : active ? "I've got my ears on." : "Your call's tiny bodyguard."}</h2>
          <p>{demoBusy ? "Gemini is checking the full example." : session.state.message}</p></div>
        <RiskMeter score={score} label="Warning-phrase score" signals />
        <p className="trigger-note">{SIGNAL_THRESHOLD} points starts a closer check. Words alone do not prove a scam.</p>
        {signals.length > 0 && <ul className="signal-list" aria-label="Weighted warning phrases">{signals.map(signal => <li key={signal.id}><span>{signal.label}<small>“{signal.phrase}”</small></span><strong>+{signal.weight}</strong></li>)}</ul>}
        {active && <p className="listening-duration">Listening for {Math.floor(session.state.seconds / 60)}:{String(session.state.seconds % 60).padStart(2, "0")} · {session.state.mode === "keywords" ? "Phrase-triggered checks" : "20-second audio checks"}</p>}
        {!active && !demoBusy && <><label className="consent-note"><input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} />
          <span>Listen while this page is open. Browser speech recognition may send audio to its provider. Flagged clips go to ElevenLabs and words to Google. If browser speech recognition is unavailable, ElevenLabs checks a clip every 20 seconds.</span></label>
          <button className="answer-button" disabled={!consented || starting} onClick={() => void start()}><Mic size={28} />{starting ? "Connecting…" : "Start protection"}</button></>}
        {active && <div className="monitor-actions"><button className="hangup-button" onClick={() => session.stop()}><MicOff size={24} />Stop listening</button>
          <button className="again-button" disabled={session.state.status !== "listening"} onClick={() => void session.checkNow()}>Check now</button></div>}
        <p className="monitor-limit">Keep this page open and your device awake. Listening pauses for a scam warning.</p>
      </section>
      {(error || session.state.status === "error") && <div className="error-message" role="alert"><AlertTriangle size={24} /><p>{error || session.state.message}</p></div>}
      {result && <section className={`result-panel ${result.level === "safe" ? "safe" : "caution"}`} aria-live="polite"><h2>{result.level === "safe" ? "This part of the call looks safe." : "Be careful — this call shows warning signs."}</h2>
        <RiskMeter score={result.risk_score} label="Verified call risk" /><ul>{result.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></section>}
      {!active && <details className="demo-panel" open={demoOpen} onToggle={event => setDemoOpen(event.currentTarget.open)}><summary>Try a demo call</summary>
        <p>See the phrase weights, then let Gemini check the example.</p><div className="demo-buttons">
          <button disabled={demoBusy || starting} onClick={() => void demo("irs")}>Play IRS scam</button>
          <button disabled={demoBusy || starting} onClick={() => void demo("romance")}>Play romance scam</button>
          <button disabled={demoBusy || starting} onClick={() => void demo("phishing")}>Play phishing text</button></div></details>}
    </section>
    <footer className="footer-note">CallCanary listens through your microphone, not directly to telephone audio. Use speakerphone.<br />Scams without these phrases can be missed. Tap Check now whenever you are unsure.</footer>
  </main>;
}
