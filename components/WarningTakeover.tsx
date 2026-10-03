"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Headphones } from "lucide-react";
import type { Analysis } from "@/lib/analysis";
import RiskMeter from "./RiskMeter";
import Mascot from "./Mascot";
import SafetyActions from "./SafetyActions";
import { warningText } from "@/lib/warningText";
import { speakWithDeviceVoice } from "@/lib/deviceVoice";
export default function WarningTakeover({ result, audioUrl, audioError, onRetry, onReset }: {
  result: Analysis; audioUrl: string; audioError: boolean; onRetry: () => void; onReset: () => void;
}) {
  const [blocked, setBlocked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [deviceVoice, setDeviceVoice] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const spoken = warningText(result.reasons, "scam");
  useEffect(() => { heading.current?.focus(); }, []);
  function playDeviceVoice() {
    audio.current?.pause(); setDeviceVoice(true);
    const started = speakWithDeviceVoice(spoken, { onStart: () => { setSpeaking(true); setBlocked(false); }, onEnd: () => setSpeaking(false), onError: () => { setSpeaking(false); setBlocked(true); } });
    if (!started) setBlocked(true);
  }
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (!audioUrl || !audio.current) return;
    const player = audio.current;
    // Browsers may block autoplay; the visible controls and the button below are the fallback.
    void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    return () => { player.pause(); };
  }, [audioUrl]);
  return <main className="takeover"><div className="takeover-inner">
    <Mascot mood={speaking ? "speaking" : "warning"} />
    <p className="takeover-kicker">CALLCANARY ALERT</p>
    <h1 ref={heading} tabIndex={-1}>SCAM CALL DETECTED<span>HANG UP NOW</span></h1>
    <p className="takeover-lead">Do not send money. Do not share codes or personal information.</p>
    <p className="warning-paused">Protection is paused while CallCanary explains. Tap “Check another call” to turn it back on.</p>
    <RiskMeter score={result.risk_score} />
    <div className="voice-status" role="status">{deviceVoice ? speaking ? "CallCanary is explaining with your device voice." : "Device voice backup selected." : audioError ? "CallCanary's voice is unavailable. Use the device voice below." : blocked ? "Tap Play below to hear CallCanary explain." : audioUrl ? speaking ? "CallCanary is explaining what it heard." : "Spoken warning ready." : "Preparing CallCanary's explanation…"}</div>
    {audioUrl && <audio ref={audio} controls src={audioUrl} onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} onError={() => { setBlocked(true); setSpeaking(false); }} aria-label="CallCanary explains this scam" />}
    {(audioError || blocked) && <div className="voice-fallback">
      {blocked && audioUrl && <button className="play-warning" onClick={() => void audio.current?.play().catch(() => setBlocked(true))}><Headphones size={24} />Play CallCanary&apos;s warning</button>}
      <button className={audioUrl ? "new-check" : "play-warning"} onClick={playDeviceVoice}><Headphones size={24} />Hear it with device voice</button>
      {audioError && <button className="new-check" onClick={onRetry}>Retry CallCanary&apos;s voice</button>}
    </div>}
    <SafetyActions result={result} />
    <section className="education-card" aria-labelledby="red-flags-title">
      <div className="education-heading"><AlertTriangle size={30} /><h2 id="red-flags-title">Why this is a scam:</h2></div>
      <ul className="flag-list">{result.reasons.map((reason, i) => <li key={`r${i}`}><span>{reason}</span></li>)}
        {result.red_flags.map((flag, i) => <li key={i}><strong>“{flag.phrase}”</strong><span>{flag.explanation}</span></li>)}</ul>
    </section>
    <button className="new-check" onClick={onReset}>Check another call</button>
  </div></main>;
}
