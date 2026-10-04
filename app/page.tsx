"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, CheckCircle, MagnifyingGlass, Microphone, MicrophoneSlash, PlayCircle, ShieldSlash, SpeakerHigh, Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Analysis } from "@/lib/analysis";
import { demoTranscripts } from "@/lib/demoTranscripts";
import { scoreSignals, SIGNAL_THRESHOLD } from "@/lib/scamSignals";
import { analyzeTranscript, useListening } from "@/lib/useListening";
import RiskMeter from "@/components/RiskMeter";
import WarningTakeover from "@/components/WarningTakeover";
import TopBar from "@/components/TopBar";
import { addHistory } from "@/lib/history";
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
  function handleVerdict(verdict: Analysis, sample = false) {
    setResult(verdict);
    addHistory({ kind: "call", verdict: verdict.level === "scam" ? "scam" : verdict.level === "suspicious" ? "careful" : "safe", sample,
      title: `Listened to a call: ${verdict.level === "scam" ? "scam detected" : verdict.level === "suspicious" ? "warning signs" : "looked safe"}`,
      details: verdict.reasons.slice(0, 2) });
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
      if (!controller.signal.aborted) handleVerdict(verdict, true);
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

  return <main className="min-h-dvh">
    <TopBar active="call">
      <Badge variant={health?.ready ? "safe" : health ? "warn" : "outline"} className="hidden sm:inline-flex">{health === null ? "Checking…" : health.ready ? "Connected" : "Setup needed"}</Badge>
    </TopBar>
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="grid gap-2 text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">Your canary in the coal mine for phone scams</p>
        <h1 className="text-balance font-display text-4xl font-extrabold leading-tight sm:text-5xl">A little bird. A big warning.</h1>
        <p className="text-pretty text-xl text-muted-foreground">Turn on protection, put your call on speaker, and I&apos;ll listen for trouble.</p>
      </header>

      {health && !health.ready && <Collapsible asChild><Card className="border-warn bg-warn-soft">
        <CollapsibleTrigger className="flex min-h-16 w-full items-center gap-3 px-5 text-left text-xl font-extrabold"><Warning size={26} weight="fill" className="text-warn" aria-hidden="true" />Connect CallCanary to its voice and safety check</CollapsibleTrigger>
        <CollapsibleContent><CardContent className="grid gap-2 text-lg">
          <p>Set the missing variables in <code>.env.local</code> and in Vercel, then restart or redeploy.</p>
          <ul className="list-disc pl-6"><li>ElevenLabs transcription: {health.transcription ? "set" : "not set"} (<code>ELEVENLABS_API_KEY</code>)</li>
            <li>Gemini scam analysis: {health.analysis ? "set" : "not set"} (<code>GEMINI_API_KEY</code>)</li>
            <li>Mascot voice: {health.voice ? "set" : "not set"} (<code>ELEVENLABS_MASCOT_VOICE_ID</code>)</li></ul>
        </CardContent></CollapsibleContent>
      </Card></Collapsible>}

      <Card className={cn("overflow-hidden transition-colors", active && "border-primary ring-4 ring-primary/15")} aria-label="Continuous call protection">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
              <span className={cn("relative flex size-3")}>{active && <span className="absolute inline-flex size-full animate-ping rounded-full bg-safe opacity-60 motion-reduce:animate-none" />}<span className={cn("relative inline-flex size-3 rounded-full", active ? "bg-safe" : "bg-muted-foreground")} /></span>
              {demoBusy ? "Checking example" : session.state.status === "off" ? "Off" : session.state.status}
            </span>
            {active && <span className="text-base font-bold tabular-nums text-muted-foreground">{Math.floor(session.state.seconds / 60)}:{String(session.state.seconds % 60).padStart(2, "0")}</span>}
          </div>
          <Mascot mood={mood} size="lg" />
          <div aria-live="polite" className="grid gap-1">
            <AnimatePresence mode="wait"><motion.h2 key={mood} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
              className="font-display text-3xl font-extrabold">{mood === "concerned" ? "Hmm… let me check that." : explaining ? "Here's what I heard." : active ? "I've got my ears on." : "Zzz… I'm off duty."}</motion.h2></AnimatePresence>
            <p className="text-xl text-muted-foreground">{demoBusy ? "Gemini is checking the full example." : session.state.message}</p>
          </div>
          {active && session.state.warning && <Alert variant="warn" role="alert" className="text-left"><Warning weight="fill" /><AlertDescription>{session.state.warning}</AlertDescription></Alert>}
          <RiskMeter score={score} label="Warning-phrase score" signals />
          <p className="text-base text-muted-foreground">{SIGNAL_THRESHOLD} points starts a closer check. Words alone don&apos;t prove a scam.</p>
          {signals.length > 0 && <ul className="grid w-full gap-2" aria-label="Weighted warning phrases">{signals.map((signal, i) => <motion.li key={signal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
            className="flex items-center justify-between gap-3 rounded-xl bg-accent/40 px-4 py-3 text-left">
            <span className="min-w-0"><strong className="block text-xl">{signal.label}</strong><span className="text-base text-muted-foreground">“{signal.phrase}”{signal.note === "negated" ? " · said with “not”, counts less" : signal.note === "discussion" ? " · sounds like talk about scams, counts less" : ""}</span></span>
            <strong className="font-display text-2xl tabular-nums text-[hsl(40_90%_28%)]">+{signal.weight}</strong>
          </motion.li>)}</ul>}
          {active && <p className="text-base text-muted-foreground">{session.state.mode === "keywords" ? "Phrase-triggered checks" : "20-second audio checks"}{session.awake !== "off" && (session.awake === "held" ? " · Your screen will stay on." : " · Keep your screen on.")}</p>}
          {!active && !demoBusy && <div className="grid w-full gap-4">
            <div className="flex items-start gap-4 rounded-xl bg-muted/60 p-4 text-left">
              <Switch id="consent" checked={consented} onCheckedChange={setConsented} className="mt-1" />
              <Label htmlFor="consent" className="text-lg font-semibold leading-relaxed">Listen while this page is open. Browser speech recognition may send audio to its provider. Flagged clips go to ElevenLabs and words to Google.</Label>
            </div>
            <Button variant="canary" size="xl" disabled={!consented || starting} onClick={() => void start()}><Microphone weight="fill" />{starting ? "Connecting…" : "Start protection"}</Button>
          </div>}
          {active && <div className="grid w-full gap-3">
            <Button variant="destructive" size="xl" onClick={() => session.stop()}><MicrophoneSlash weight="fill" />Stop listening</Button>
            <Button variant="secondary" size="lg" disabled={session.state.status !== "listening"} onClick={() => void session.checkNow()}><MagnifyingGlass weight="bold" />Check now</Button>
          </div>}
          <p className="text-base text-muted-foreground">Keep this page open and your device awake. Listening pauses for a scam warning.</p>
        </CardContent>
      </Card>

      <AnimatePresence>{stoppedUnexpectedly && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Alert variant="stopped" role="alert" className="flex flex-wrap items-center gap-4 [&>svg]:static [&>svg~*]:pl-0">
          <ShieldSlash weight="fill" /><AlertDescription className="min-w-0 flex-1 text-xl">Protection is OFF. {session.state.message}</AlertDescription>
          <Button variant="outline" disabled={!consented || starting} onClick={() => void start()}>Turn back on</Button>
        </Alert></motion.div>}</AnimatePresence>
      {error && <Alert variant="destructive" role="alert"><Warning weight="bold" /><AlertDescription>{error}</AlertDescription></Alert>}

      <AnimatePresence>{result && <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
        <Card className={result.level === "safe" ? "border-safe/50" : "border-warn"} aria-live="polite">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-3">
            {result.level === "safe" ? <CheckCircle size={32} weight="fill" className="text-safe" aria-hidden="true" /> : <Warning size={32} weight="fill" className="text-warn" aria-hidden="true" />}
            {result.level === "safe" ? "This part of the call looks safe." : "Be careful — this call shows warning signs."}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <RiskMeter score={result.risk_score} label="Verified call risk" />
            <ul className="grid gap-2 text-xl">{result.reasons.map((reason, i) => <li key={i} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-foreground/60" />{reason}</li>)}</ul>
            <Button variant="outline" size="lg" disabled={explaining} onClick={() => void explain(result)}><SpeakerHigh weight="fill" />{explaining ? "CallCanary is speaking…" : "Hear CallCanary explain"}</Button>
          </CardContent>
        </Card></motion.div>}</AnimatePresence>

      {!active && <Collapsible asChild><Card className="border-accent bg-[hsl(47_100%_96%)]">
        <CollapsibleTrigger className="group flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl px-6 text-left font-display text-2xl font-extrabold">
          <span className="flex items-center gap-3"><PlayCircle size={30} weight="fill" className="text-[hsl(40_90%_32%)]" aria-hidden="true" />Try a demo call</span>
          <CaretDown size={26} weight="bold" className="shrink-0 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent><CardContent className="grid gap-3">
          <p className="text-lg text-muted-foreground">See the phrase weights, then let Gemini check the example.</p>
          {([["irs", "IRS scam"], ["romance", "Romance scam"], ["phishing", "Phishing text"]] as const).map(([id, label]) =>
            <Button key={id} variant="outline" size="lg" className="justify-start" disabled={demoBusy || starting} onClick={() => void demo(id)}><PlayCircle weight="fill" className="text-primary" />{label}</Button>)}
        </CardContent></CollapsibleContent>
      </Card></Collapsible>}
      <p className="text-center text-base text-muted-foreground">CallCanary listens through your microphone, not directly to the phone line, so use speakerphone. Scams without these phrases can be missed: tap Check now whenever you&apos;re unsure.</p>
    </div>
  </main>;
}
