"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Headphones, Phone, Shield, Siren, X } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import RiskMeter from "./RiskMeter";
export default function WarningTakeover({ result, audioUrl, audioError, onRetry, onReset }: {
  result: Analysis; audioUrl: string; audioError: boolean; onRetry: () => void; onReset: () => void;
}) {
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!audioUrl || !audio.current) return;
    const player = audio.current;
    void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    return () => { player.pause(); };
  }, [audioUrl]);
  return <main className="takeover"><div className="takeover-inner">
    <div className="alarm-mark" aria-hidden="true"><Siren size={56} /></div>
    <p className="takeover-kicker">CALLCANARY ALERT</p>
    <h1 ref={heading} tabIndex={-1}>SCAM CALL DETECTED<span>DELETE &amp; BLOCK THIS NUMBER</span></h1>
    <p className="takeover-lead">Do not send money. Do not share personal information.</p>
    <RiskMeter score={result.risk_score} />
    <div className="voice-status" role="status">{audioError ? "The warning could not play. Read the instructions above." : blocked ? "Tap Play below to hear the spoken warning." : audioUrl ? "Spoken warning ready" : "Preparing spoken warning…"}</div>
    {audioUrl && <audio ref={audio} controls src={audioUrl} onError={() => setBlocked(true)} aria-label="Spoken scam warning" />}
    {audioError && !audioUrl && <button className="play-warning" onClick={onRetry}><Headphones size={24} />Play spoken warning</button>}
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
