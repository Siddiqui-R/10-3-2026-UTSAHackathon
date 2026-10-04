"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowCounterClockwise, Play, SpeakerHigh, Warning } from "@phosphor-icons/react";
import type { Analysis } from "@/lib/analysis";
import RiskMeter from "./RiskMeter";
import Mascot from "./Mascot";
import SafetyActions from "./SafetyActions";
import { Button } from "@/components/ui/button";
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
  const status = deviceVoice ? speaking ? "CallCanary is explaining with your device voice." : "Device voice backup selected."
    : audioError ? "CallCanary's voice is unavailable. Use the device voice below." : blocked ? "Tap Play below to hear CallCanary explain."
    : audioUrl ? speaking ? "CallCanary is explaining what it heard." : "Spoken warning ready." : "Preparing CallCanary's explanation…";
  return <motion.main initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
    className="alarm-rings min-h-dvh px-4 pb-12 pt-8 text-white">
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
      <Mascot mood={speaking ? "speaking" : "warning"} size="lg" />
      <p className="rounded-full bg-white/15 px-4 py-1.5 text-base font-extrabold uppercase tracking-[0.14em]">CallCanary alert</p>
      <motion.h1 ref={heading} tabIndex={-1} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className="text-balance font-display text-5xl font-extrabold leading-[1.02] outline-none sm:text-6xl">SCAM CALL DETECTED<span className="mt-2 block text-3xl text-[#ffe08a] sm:text-4xl">HANG UP NOW</span></motion.h1>
      <p className="text-pretty text-2xl font-bold">Do not send money. Do not share codes or personal information.</p>
      <p className="text-lg text-white/85">Protection is paused while CallCanary explains. Tap “Check another call” to turn it back on.</p>
      <div className="w-full max-w-md"><RiskMeter score={result.risk_score} tone="dark" /></div>
      <div className="grid w-full max-w-md gap-3 rounded-2xl bg-white/10 p-4" role="status">
        <p className="flex items-center justify-center gap-2 text-lg font-bold"><SpeakerHigh size={24} weight="fill" aria-hidden="true" />{status}</p>
        {audioUrl && <audio ref={audio} controls src={audioUrl} className="w-full" onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} onError={() => { setBlocked(true); setSpeaking(false); }} aria-label="CallCanary explains this scam" />}
        {(audioError || blocked) && <div className="grid gap-2">
          {blocked && audioUrl && <Button variant="outline" size="lg" className="border-white bg-white text-destructive" onClick={() => void audio.current?.play().catch(() => setBlocked(true))}><Play weight="fill" />Play CallCanary&apos;s warning</Button>}
          <Button variant="outline" size="lg" className="border-white bg-transparent text-white hover:bg-white/10" onClick={playDeviceVoice}><SpeakerHigh weight="fill" />Hear it with device voice</Button>
          {audioError && <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onRetry}>Retry CallCanary&apos;s voice</Button>}
        </div>}
      </div>
      <div className="w-full"><SafetyActions result={result} tone="alarm" /></div>
      <section className="w-full rounded-2xl bg-card p-6 text-left text-foreground shadow-xl" aria-labelledby="red-flags-title">
        <h2 id="red-flags-title" className="mb-3 flex items-center gap-3 font-display text-3xl font-extrabold"><Warning size={32} weight="fill" className="text-danger" aria-hidden="true" />Why this is a scam</h2>
        <ul className="grid gap-4">
          {result.reasons.map((reason, i) => <motion.li key={`r${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + 0.08 * i }} className="text-xl leading-relaxed">{reason}</motion.li>)}
          {result.red_flags.map((flag, i) => <li key={i} className="grid gap-1 border-t-2 pt-4 text-xl"><strong className="text-danger">“{flag.phrase}”</strong><span className="text-muted-foreground">{flag.explanation}</span></li>)}
        </ul>
      </section>
      <Button variant="outline" size="xl" className="border-white bg-transparent text-white hover:bg-white/10" onClick={onReset}><ArrowCounterClockwise weight="bold" />Check another call</Button>
    </div>
  </motion.main>;
}
