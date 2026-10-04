"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Headphones, Mic, MicOff, ShieldOff } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import { demoTranscripts } from "@/lib/demoTranscripts";
import { scoreSignals, SIGNAL_THRESHOLD } from "@/lib/scamSignals";
import { analyzeTranscript, useListening } from "@/lib/useListening";
import RiskMeter from "@/components/RiskMeter";
import WarningTakeover from "@/components/WarningTakeover";
import TopBar from "@/components/TopBar";
import Mascot, { type MascotMood } from "@/components/Mascot";
import { warningText } from "@/lib/warningText";
import { speakWithDeviceVoice } from "@/lib/deviceVoice";

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
  const explainAudio = useRef<HTMLAudioElement | null>(null);
  const [explaining, setExplaining] = useState(false);
  const session = useListening(handleVerdict);

  async function prepareWarning(verdict: Analysis) {
    speechRequest.current?.abort();
    const controller = new AbortController(); speechRequest.current = controller;
    setAudioError(false);
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: verdict.level, reasons: verdict.reasons.slice(0, 3) }), signal: controller.signal });
      if (!response.ok) throw new Error("Voice unavailable");
      const blob = await response.blob();
      if (!controller.signal.aborted) setAudioUrl(URL.createObjectURL(blob));
    } catch { if (!controller.signal.aborted) setAudioError(true); }
  }
  async function explain(verdict: Analysis) {
    explainAudio.current?.pause(); setExplaining(true);
    const text = warningText(verdict.reasons, verdict.level);
    session.holdTriggers(30_000);
    const done = () => { setExplaining(false); session.holdTriggers(1500); };
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: verdict.level, reasons: verdict.reasons.slice(0, 3) }) });
      if (!response.ok) throw new Error("voice unavailable");
      const url = URL.createObjectURL(await response.blob());
      const player = new Audio(url); explainAudio.current = player;
      player.onended = player.onerror = () => { URL.revokeObjectURL(url); done(); };
      await player.play();
    } catch {
      if (!speakWithDeviceVoice(text, { onStart: () => {}, onEnd: done, onError: done })) done();
    }
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
    explainAudio.current?.pause(); setExplaining(false);
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
  const mood: MascotMood = demoBusy || session.state.status === "checking" ? "concerned" : explaining ? "speaking" : active ? "alert" : "sleeping";
  // Protection that stopped on its own (error, disconnect, page suspended) must be impossible to miss.
  const stoppedUnexpectedly = session.state.status === "error" || (session.state.status === "off" && !["Protection is off", "Protection paused for the scam warning"].includes(session.state.message));

  if (result?.level === "scam") return <WarningTakeover result={result} audioUrl={audioUrl} audioError={audioError}
    onRetry={() => void prepareWarning(result)} onReset={reset} />;

  return <main className="app-shell">
    <TopBar active="call">
      <span className={`connection-pill ${health?.ready ? "connected" : ""}`}>{health === null ? "Checking connections…" : health.ready ? "Providers configured" : "Setup needed"}</span></TopBar>
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
        <Mascot mood={mood} />
        <div className="mascot-bubble" aria-live="polite"><h2>{mood === "concerned" ? "Hmm… let me check that." : explaining ? "Here's what I heard." : active ? "I've got my ears on." : "Zzz… I'm off duty."}</h2>
          <p>{demoBusy ? "Gemini is checking the full example." : session.state.message}</p></div>
        {active && session.state.warning && <div className="protection-warning" role="alert"><AlertTriangle size={26} /><span>{session.state.warning}</span></div>}
        <RiskMeter score={score} label="Warning-phrase score" signals />
        <p className="trigger-note">{SIGNAL_THRESHOLD} points starts a closer check. Words alone do not prove a scam.</p>
        {signals.length > 0 && <ul className="signal-list" aria-label="Weighted warning phrases">{signals.map(signal => <li key={signal.id}><span>{signal.label}<small>“{signal.phrase}”{signal.note === "negated" ? " · said with “not”, counts less" : signal.note === "discussion" ? " · sounds like talk about scams, counts less" : ""}</small></span><strong>+{signal.weight}</strong></li>)}</ul>}
        {active && session.awake !== "off" && <p className="listening-duration">{session.awake === "held" ? "Your screen will stay on while CallCanary listens." : "Keep your screen on — this browser can't keep it awake for you."}</p>}
        {active && <p className="listening-duration">Listening for {Math.floor(session.state.seconds / 60)}:{String(session.state.seconds % 60).padStart(2, "0")} · {session.state.mode === "keywords" ? "Phrase-triggered checks" : "20-second audio checks"}</p>}
        {!active && !demoBusy && <><label className="consent-note"><input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} />
          <span>Listen while this page is open. Browser speech recognition may send audio to its provider. Flagged clips go to ElevenLabs and words to Google. If browser speech recognition is unavailable, ElevenLabs checks a clip every 20 seconds.</span></label>
          <button className="answer-button" disabled={!consented || starting} onClick={() => void start()}><Mic size={28} />{starting ? "Connecting…" : "Start protection"}</button></>}
        {active && <div className="monitor-actions"><button className="hangup-button" onClick={() => session.stop()}><MicOff size={24} />Stop listening</button>
          <button className="again-button" disabled={session.state.status !== "listening"} onClick={() => void session.checkNow()}>Check now</button></div>}
        <p className="monitor-limit">Keep this page open and your device awake. Listening pauses for a scam warning.</p>
      </section>
      {stoppedUnexpectedly && <div className="protection-stopped" role="alert"><ShieldOff size={32} /><span>Protection is OFF. {session.state.message}</span>
        <button disabled={!consented || starting} onClick={() => void start()}>Turn back on</button></div>}
      {error && <div className="error-message" role="alert"><AlertTriangle size={24} /><p>{error}</p></div>}
      {result && <section className={`result-panel ${result.level === "safe" ? "safe" : "caution"}`} aria-live="polite"><h2>{result.level === "safe" ? "This part of the call looks safe." : "Be careful — this call shows warning signs."}</h2>
        <RiskMeter score={result.risk_score} label="Verified call risk" /><ul>{result.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
        <button className="hear-why" disabled={explaining} onClick={() => void explain(result)}><Headphones size={24} />{explaining ? "CallCanary is speaking…" : "Hear CallCanary explain"}</button></section>}
      {!active && <details className="demo-panel" open={demoOpen} onToggle={event => setDemoOpen(event.currentTarget.open)}><summary>Try a demo call</summary>
        <p>See the phrase weights, then let Gemini check the example.</p><div className="demo-buttons">
          <button disabled={demoBusy || starting} onClick={() => void demo("irs")}>Play IRS scam</button>
          <button disabled={demoBusy || starting} onClick={() => void demo("romance")}>Play romance scam</button>
          <button disabled={demoBusy || starting} onClick={() => void demo("phishing")}>Play phishing text</button></div></details>}
    </section>
    <footer className="footer-note">CallCanary listens through your microphone, not directly to telephone audio. Use speakerphone.<br />Scams without these phrases can be missed. Tap Check now whenever you are unsure.</footer>
  </main>;
}
