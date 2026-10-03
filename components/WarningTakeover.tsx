"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Headphones, Phone, Shield, X } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import RiskMeter from "./RiskMeter";
import Mascot from "./Mascot";
import { warningText } from "@/lib/warningText";
export default function WarningTakeover({ result, audioUrl, audioError, onRetry, onReset }: {
  result: Analysis; audioUrl: string; audioError: boolean; onRetry: () => void; onReset: () => void;
}) {
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [deviceVoice, setDeviceVoice] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  function playDeviceVoice() {
    if (!("speechSynthesis" in window)) { setBlocked(true); return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(warningText(result.reasons.slice(0, 3)));
    speech.lang = "en-US"; speech.rate = 0.9; speech.pitch = 1.05;
    speech.onstart = () => { setSpeaking(true); setBlocked(false); };
    speech.onend = () => setSpeaking(false);
    speech.onerror = () => { setSpeaking(false); setBlocked(true); };
    setDeviceVoice(true); window.speechSynthesis.speak(speech);
  }
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (!audioUrl || !audio.current) return;
    const player = audio.current;
    void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    return () => { player.pause(); };
  }, [audioUrl]);
  return <main className="takeover"><div className="takeover-inner">
    <Mascot alert speaking={speaking} />
    <p className="takeover-kicker">CALLCANARY ALERT</p>
    <h1 ref={heading} tabIndex={-1}>SCAM CALL DETECTED<span>DELETE &amp; BLOCK THIS NUMBER</span></h1>
    <p className="takeover-lead">Do not send money. Do not share personal information.</p>
    <p className="warning-paused">Microphone paused so CallCanary can explain what it found.</p>
    <RiskMeter score={result.risk_score} />
    <div className="voice-status" role="status">{deviceVoice ? speaking ? "CallCanary is explaining with your device voice." : "Device voice backup selected." : audioError ? "ElevenLabs voice is unavailable. Use the device voice below." : blocked ? "Tap Play below to hear the spoken warning." : audioUrl ? "Spoken warning ready" : "Preparing spoken warning…"}</div>
    {audioUrl && <audio ref={audio} controls src={audioUrl} onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} onError={() => { setBlocked(true); setSpeaking(false); }} aria-label="CallCanary explains this scam" />}
    {audioError && !audioUrl && <div className="voice-fallback"><button className="play-warning" onClick={playDeviceVoice}><Headphones size={24} />Hear explanation with device voice</button><button className="new-check" onClick={onRetry}>Retry ElevenLabs voice</button></div>}
    <div className="action-grid" aria-label="Call safety actions">
      <button className="takeover-action" onClick={() => setMessage("Call deleted. Good job staying safe.")}><X size={28} />Delete this call</button>
      <button className="takeover-action" onClick={() => setMessage("Number blocked.")}><Shield size={28} />Block this number</button>
      <button className="takeover-action" onClick={() => setMessage("Your trusted contact has been notified.")}><Phone size={28} />Alert my trusted contact</button>
    </div>
    <p className="mock-note">Demo actions: this website cannot change your phone or send a notification.</p>
    {message && <p className="action-confirmation" role="status"><Check size={24} />{message}</p>}
    <section className="education-card" aria-labelledby="red-flags-title">
      <div className="education-heading"><AlertTriangle size={30} /><h2 id="red-flags-title">Why this was a scam:</h2></div>
      <ul className="flag-list">{result.red_flags.map((flag, i) => <li key={i}><strong>“{flag.phrase}”</strong><span>{flag.explanation}</span></li>)}</ul>
    </section>
    <button className="new-check" onClick={onReset}>Check another call</button>
  </div></main>;
}
