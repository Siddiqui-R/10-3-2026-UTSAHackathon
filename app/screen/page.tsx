"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowCounterClockwise, CaretDown, CheckCircle, Hash, Phone, PhoneDisconnect, PhoneIncoming, PlayCircle, Prohibit, SpeakerHigh, Stop, Trash, UserPlus, UsersThree, Warning, XCircle } from "@phosphor-icons/react";
import TopBar from "@/components/TopBar";
import Mascot, { type MascotMood } from "@/components/Mascot";
import SafetyActions from "@/components/SafetyActions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NumberCheck } from "@/lib/reportedNumbers";
import type { ScreenLayer, ScreenResult } from "@/lib/screening";
import { SCREEN_GOODBYE, SCREEN_GREETING } from "@/lib/screening";
import { runScreen, type ScreenProgress } from "@/lib/screenClient";
import { sanitizeContacts, type TrustedContact } from "@/lib/contacts";
import { loadContacts, saveContacts } from "@/lib/contactStore";
import { formatUsNumber, normalizeUsNumber } from "@/lib/phoneNumber";
import { DEMO_CONTACTS, SCREEN_DEMOS, type ScreenDemo } from "@/lib/screenDemos";
import { speakWithDeviceVoice } from "@/lib/deviceVoice";
import { addHistory } from "@/lib/history";
import { at, cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type Stage = "idle" | "greeting" | "recording" | "checking" | "done";
const MAX_REPLY_MS = 20_000;
const NO_SPEECH_MS = 8_000;
const END_SILENCE_MS = 2_500;
const SPEECH_LEVEL = 0.02;
// Ring color carries the state before any words are read, like a phone's call screen.
const ring = { idle: "bg-white/15", greeting: "bg-[#ffcc00]", recording: "bg-[#34c759]", checking: "bg-[#ffcc00]", done: "bg-white/15", scam: "bg-[#ff3b30]", careful: "bg-[#ffcc00]", safe: "bg-[#34c759]" } as const;
// Atmosphere glow behind the canary for each state.
const glowColor = { idle: "rgba(244,207,71,0.30)", greeting: "rgba(255,204,0,0.34)", recording: "rgba(52,199,89,0.32)", checking: "rgba(255,204,0,0.30)", done: "rgba(244,207,71,0.28)", scam: "rgba(255,59,48,0.46)", careful: "rgba(255,204,0,0.40)", safe: "rgba(52,199,89,0.38)" } as const;
const verdictText = { scam: "text-[#ffb4ae]", careful: "text-[#ffe08a]", safe: "text-[#9ff0b8]" } as const;
const layerLook: Record<ScreenLayer["status"], { Icon: typeof CheckCircle; className: string; word: string }> = {
  flagged: { Icon: XCircle, className: "text-danger", word: "Warning" },
  clear: { Icon: CheckCircle, className: "text-safe", word: "OK" },
  info: { Icon: Warning, className: "text-warn", word: "Note" },
  skipped: { Icon: Prohibit, className: "text-muted-foreground", word: "Skipped" },
  unavailable: { Icon: Prohibit, className: "text-muted-foreground", word: "Unavailable" },
  pending: { Icon: CaretDown, className: "text-muted-foreground animate-pulse", word: "Checking" },
};

async function fetchVoice(script: "greeting" | "goodbye") {
  const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script }) });
  if (!response.ok) throw new Error("voice unavailable");
  return URL.createObjectURL(await response.blob());
}
/** Play a recording; falls back to the device voice reading `text`. Resolves when it finishes. */
function playAudio(url: string | undefined, text: string, onPlayer?: (audio: HTMLAudioElement) => void) {
  return new Promise<void>(resolve => {
    const viaDevice = () => { if (!speakWithDeviceVoice(text, { onStart: () => {}, onEnd: () => resolve(), onError: () => resolve() })) resolve(); };
    if (!url) { viaDevice(); return; }
    const audio = new Audio(url); onPlayer?.(audio);
    audio.onended = () => resolve(); audio.onerror = viaDevice; audio.onpause = () => { if (!audio.ended) resolve(); };
    audio.play().catch(viaDevice);
  });
}

export default function ScreenCaller() {
  const [stage, setStage] = useState<Stage>("idle");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<(NumberCheck & { error?: string }) | null>(null);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [progress, setProgress] = useState<ScreenProgress | null>(null);
  const [error, setError] = useState("");
  const [heard, setHeard] = useState(false);
  const [goodbye, setGoodbye] = useState<"idle" | "playing" | "done">("idle");
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [demo, setDemo] = useState<ScreenDemo | null>(null);
  const greetingUrl = useRef<string>();
  const cancel = useRef<() => void>(() => {});
  const stopRecording = useRef<() => void>(() => {});
  const actionsRef = useRef<HTMLDivElement>(null);
  // Prepare the greeting early so it plays right after the tap (browsers block late autoplay).
  useEffect(() => {
    let alive = true;
    setContacts(loadContacts());
    void fetchVoice("greeting").then(url => { if (alive) greetingUrl.current = url; else URL.revokeObjectURL(url); }).catch(() => {});
    return () => { alive = false; cancel.current(); if (greetingUrl.current) URL.revokeObjectURL(greetingUrl.current); };
  }, []);
  function updateContacts(next: TrustedContact[]) { setContacts(next); saveContacts(next); }

  async function checkNumber() {
    setLooking(true); setLookup(null);
    try {
      const found: NumberCheck & { error?: string } = await (await fetch(`/api/check-number?phone=${encodeURIComponent(phone)}`)).json();
      setLookup(found);
      if (found.status === "reported" || found.status === "not_reported") addHistory({ kind: "number", verdict: found.status === "reported" ? "scam" : "info",
        title: found.status === "reported" ? `Checked a number: reported ${found.reports} ${found.reports === 1 ? "time" : "times"}` : "Checked a number: not on the FTC list",
        details: [formatUsNumber(found.number), found.status === "reported" ? `Most recently ${found.last_reported}, “${found.topic}”` : `FTC complaints ${found.from} to ${found.to}`] });
    }
    catch { setLookup({ status: "unavailable", number: phone, detail: "The check could not finish. Please try again." }); }
    finally { setLooking(false); }
  }
  async function submit(audio: Blob, callerPhone: string, contactList: TrustedContact[], isCancelled: () => boolean, sample?: ScreenDemo) {
    setStage("checking"); setProgress(null);
    const form = new FormData();
    form.append("audio", audio, audio.type.includes("mp4") ? "reply.mp4" : audio.type.includes("mpeg") ? "reply.mp3" : "reply.webm");
    if (callerPhone.trim()) form.append("phone", callerPhone);
    form.append("contacts", JSON.stringify(contactList));
    try {
      const final = await runScreen(form, update => { if (!isCancelled()) setProgress(update); });
      if (!isCancelled()) {
        setResult(final); setStage("done");
        const digits = normalizeUsNumber(callerPhone);
        const decided = final.layers.find(layer => layer.id === final.decided_by)?.label;
        addHistory({ kind: "screen", verdict: final.verdict, title: `Screened a call: ${final.headline}`, sample: !!sample,
          details: [[final.stated_name, final.stated_reason].filter(Boolean).join(" — "), digits ? formatUsNumber(digits) : "", decided ? `Decided by: ${decided}` : ""] });
      }
    } catch (cause) { if (!isCancelled()) { setError(cause instanceof Error ? cause.message : "The screen could not finish."); setStage("idle"); } }
  }

  async function answer() {
    setError(""); setResult(null); setHeard(false); setGoodbye("idle"); setDemo(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setError("CallCanary needs the microphone to hear the caller. Allow microphone access and try again."); return; }
    let stopped = false;
    const release = () => { stream.getTracks().forEach(track => track.stop()); };
    cancel.current = () => { stopped = true; release(); window.speechSynthesis?.cancel(); };
    setStage("greeting");
    await playAudio(greetingUrl.current, SCREEN_GREETING);
    if (stopped) return;
    // Record only after the greeting, so CallCanary never hears itself.
    setStage("recording");
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const context = new AudioContext(); const analyser = context.createAnalyser(); analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const startedAt = Date.now(); let spoke = false; let lastSound = Date.now();
    const finished = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    const finish = () => { clearInterval(meter); if (recorder.state !== "inactive") recorder.stop(); };
    cancel.current = () => { stopped = true; finish(); release(); void context.close(); };
    // Stop when the caller finishes speaking, never speaks, or talks too long.
    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      const now = Date.now();
      if (level >= SPEECH_LEVEL) { lastSound = now; if (!spoke) { spoke = true; setHeard(true); } }
      if ((spoke && now - lastSound > END_SILENCE_MS) || (!spoke && now - startedAt > NO_SPEECH_MS) || now - startedAt > MAX_REPLY_MS) finish();
    }, 200);
    recorder.start(1000);
    stopRecording.current = finish;
    await finished; release(); void context.close();
    if (stopped) return;
    await submit(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), phone, contacts, () => stopped);
  }

  // A sample call: the greeting, then the recorded caller out loud, then the same checks as a real call.
  async function runDemo(sample: ScreenDemo) {
    setError(""); setResult(null); setGoodbye("idle"); setDemo(sample); setPhone(sample.phone); setLookup(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    let stopped = false; let player: HTMLAudioElement | undefined;
    cancel.current = () => { stopped = true; player?.pause(); window.speechSynthesis?.cancel(); };
    setStage("greeting");
    await playAudio(greetingUrl.current, SCREEN_GREETING, audio => { player = audio; });
    if (stopped) return;
    setStage("recording"); setHeard(true);
    await playAudio(sample.audio, sample.text, audio => { player = audio; });
    if (stopped) return;
    let audio: Blob;
    try { audio = await (await fetch(sample.audio)).blob(); }
    catch { setError("The sample call couldn't be loaded."); setStage("idle"); return; }
    await submit(new Blob([audio], { type: "audio/mpeg" }), sample.phone, DEMO_CONTACTS, () => stopped, sample);
  }

  async function sayGoodbye() {
    setGoodbye("playing");
    let url: string | undefined;
    try { url = await fetchVoice("goodbye"); } catch { url = undefined; }
    await playAudio(url, SCREEN_GOODBYE);
    if (url) URL.revokeObjectURL(url);
    setGoodbye("done");
    toast.success("CallCanary said goodbye", { description: "Now hang up on your phone." });
  }
  function reset() { cancel.current(); setStage("idle"); setResult(null); setProgress(null); setError(""); setGoodbye("idle"); setDemo(null); window.scrollTo({ top: 0 }); }

  const mood: MascotMood = stage === "greeting" ? "speaking" : stage === "recording" ? "alert" : stage === "checking" ? "concerned"
    : result?.verdict === "scam" ? "warning" : result?.verdict === "careful" ? "concerned" : stage === "done" ? "alert" : "sleeping";
  const ringColor = stage === "done" && result ? ring[result.verdict] : ring[stage];
  const glow = stage === "done" && result ? glowColor[result.verdict] : glowColor[stage];
  const callerDigits = normalizeUsNumber(phone);
  const callerLine = callerDigits ? formatUsNumber(callerDigits) : "Unknown number";
  const analysis = { risk_score: 90, level: "scam" as const, scam_type: "other" as const, reasons: [result?.explanation || ""], red_flags: [] };

  return <main className="min-h-dvh">
    <TopBar active="screen" />
    {/* Direction C: the phone's own call screen, lit like the coal band; the glow takes the call's state. */}
    <section aria-label="Call screen" data-glow="" style={{ "--glow": glow } as CSSProperties} className="mine overflow-hidden px-5 pb-12 pt-8 text-center text-white">
     <div className="mx-auto max-w-3xl">
      {stage === "idle" && <div className="mb-6 grid justify-items-center gap-3">
        <p className="reveal text-sm font-bold uppercase tracking-[0.18em] text-lamp" style={at(0)}>A call from a number you don&apos;t know?</p>
        <h1 className="reveal text-balance font-display text-[clamp(2.5rem,10vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.025em] [font-stretch:86%]" style={at(1)}>Let CallCanary answer first.</h1>
        <p className="reveal max-w-xl text-pretty text-xl leading-relaxed text-[#d6e2d0]" style={at(2)}>It asks who&apos;s calling and why, then tells you whether to talk to them.</p>
      </div>}

        {demo && <p className="mx-auto mb-3 w-fit rounded-full bg-white/15 px-4 py-1.5 text-base font-bold">Sample call · {demo.label}</p>}
        <p className="text-base font-bold uppercase tracking-[0.1em] text-call-muted">{stage === "done" ? "Screened call" : stage === "idle" ? "CallCanary" : "Screening"} · {callerLine}</p>
        <AnimatePresence mode="wait">
          <motion.div key={stage === "done" ? `done-${result?.verdict}` : stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mt-1 grid gap-1">
            <h2 className={cn("text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl", stage === "idle" && "sr-only")} role="status">{stage === "idle" && "Ready when a call comes in"}
              {stage === "greeting" && "Greeting the caller…"}
              {stage === "recording" && (heard ? "Listening to the caller…" : "Waiting for the caller…")}
              {stage === "checking" && "Checking what they said…"}
              {stage === "done" && result && (result.stated_name ? `“${result.stated_name}”` : result.headline)}
            </h2>
            {stage === "done" && result && <p className={cn("text-2xl font-extrabold", verdictText[result.verdict])}>{result.stated_name ? result.headline : ""}</p>}
          </motion.div>
        </AnimatePresence>

        <div className="relative mx-auto my-5 grid size-48 place-items-center">
          {(stage === "recording" || stage === "greeting") && <motion.span aria-hidden="true" className={cn("absolute inset-0 rounded-full", ringColor)}
            animate={{ scale: [1, 1.12], opacity: [0.5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }} />}
          <div className={cn("absolute inset-0 rounded-full p-2 transition-colors duration-500", ringColor)}>
            <div className="size-full rounded-full bg-call" />
          </div>
          <Mascot mood={mood} size="md" className="relative" />
        </div>

        {stage === "greeting" && <p className="mx-auto max-w-md text-lg text-white/85">“{SCREEN_GREETING}”</p>}
        {stage === "recording" && demo && <p className="mx-auto max-w-md text-lg text-white/85">Caller: “{demo.text}”</p>}
        {stage === "done" && result && <p className="mx-auto max-w-md text-pretty text-xl leading-relaxed text-white/90">{result.explanation}</p>}
        {stage === "idle" && <p className="mx-auto max-w-md text-lg text-white/80">Answer on speaker, don&apos;t say anything, and hold your phone near this screen.</p>}

        <div className="mt-7 flex items-start justify-center gap-10">
          {stage === "idle" && <RoundButton label="Answer with CallCanary" variant="call-go" onClick={() => void answer()}><PhoneIncoming weight="fill" /></RoundButton>}
          {stage === "recording" && !demo && <RoundButton label="They're done" variant="call-muted" onClick={() => stopRecording.current()}><Stop weight="fill" /></RoundButton>}
          {(stage === "greeting" || stage === "recording" || stage === "checking") && <RoundButton label="Cancel" variant="call-stop" onClick={reset}><PhoneDisconnect weight="fill" /></RoundButton>}
          {stage === "done" && result && result.verdict !== "safe" && <>
            <RoundButton label={goodbye === "playing" ? "Saying goodbye…" : goodbye === "done" ? "Now hang up" : "Say goodbye"} variant="call-stop" disabled={goodbye === "playing"} onClick={() => void sayGoodbye()}><SpeakerHigh weight="fill" /></RoundButton>
            <RoundButton label="Block & report" variant="call-muted" onClick={() => actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><Prohibit weight="bold" /></RoundButton>
          </>}
          {stage === "done" && result?.verdict === "safe" && <RoundButton label="Talk to them" variant="call-go" onClick={() => toast.success("Go ahead and talk", { description: "Still: never send money or share codes on a call you didn't expect." })}><Phone weight="fill" /></RoundButton>}
        </div>
     </div>
    </section>
    <div className="relative mx-auto -mt-6 flex max-w-3xl flex-col gap-5 px-4 pb-6">

      {error && <Alert variant="destructive" role="alert"><Warning weight="bold" /><AlertDescription>{error}</AlertDescription></Alert>}

      {stage === "checking" && <Card><CardHeader className="pb-3"><CardTitle>How CallCanary is checking</CardTitle></CardHeader>
        <CardContent><LayerList layers={progress?.layers || []} decidedBy={null} /></CardContent></Card>}

      {stage === "done" && result && <>
        {(result.stated_name || result.stated_reason) && <Card><CardHeader className="pb-2"><CardTitle>The caller said</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-xl">
            {result.stated_name && <p>Name: <strong>{result.stated_name}</strong></p>}
            {result.stated_reason && <p>Reason: <strong>{result.stated_reason}</strong></p>}
          </CardContent></Card>}
        {result.red_flags.length > 0 && <Card className="border-danger/40"><CardHeader className="pb-2"><CardTitle>Warning signs</CardTitle></CardHeader>
          <CardContent><ul className="grid gap-2">{result.red_flags.map((flag, i) => <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}
            className="flex items-start gap-3 text-xl"><Warning size={26} weight="fill" className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />{flag}</motion.li>)}</ul></CardContent></Card>}
        <Card><CardHeader className="pb-3"><CardTitle>How CallCanary checked</CardTitle></CardHeader>
          <CardContent><LayerList layers={result.layers} decidedBy={result.decided_by} /></CardContent></Card>
        {result.verdict === "scam" && <div ref={actionsRef} className="scroll-mt-24"><SafetyActions result={analysis} /></div>}
        {result.verdict === "careful" && <p ref={actionsRef} className="scroll-mt-24 text-lg text-muted-foreground">If they really know you, they can leave a voicemail or call back. Never send money or share codes on a call you didn&apos;t expect.</p>}
        <Button variant="secondary" size="xl" onClick={reset}><ArrowCounterClockwise weight="bold" />Screen another call</Button>
      </>}

      {stage === "idle" && <>
        <Card className="reveal shadow-xl shadow-coal/10" style={at(4)}>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Hash size={28} weight="bold" aria-hidden="true" />Check the caller&apos;s number</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Label htmlFor="caller-number">Number on your phone screen (optional)</Label>
            <Input id="caller-number" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={event => { setPhone(event.target.value); setLookup(null); }} placeholder="e.g. (210) 555-0100" />
            <Button variant="outline" size="lg" disabled={!phone.trim() || looking} onClick={() => void checkNumber()}>{looking ? "Checking…" : "Check this number"}</Button>
            <AnimatePresence>{lookup && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><NumberResult lookup={lookup} /></motion.div>}</AnimatePresence>
          </CardContent>
        </Card>
        <ContactsCard contacts={contacts} onChange={updateContacts} />
        <SampleCalls onRun={sample => void runDemo(sample)} />
        <p className="text-base text-muted-foreground">The caller&apos;s reply is sent to ElevenLabs to turn it into words and to Google&apos;s Gemini to judge it. Nothing is saved. Your contacts are only compared, never stored or sent to the AI.</p>
      </>}
    </div>
  </main>;
}

function RoundButton({ label, variant, children, onClick, disabled }: { label: string; variant: "call-go" | "call-stop" | "call-muted"; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <div className="grid w-28 justify-items-center gap-2">
    <Button size="round" variant={variant} onClick={onClick} disabled={disabled} aria-label={label}>{children}</Button>
    <span className="text-base font-bold leading-tight text-white/90" aria-hidden="true">{label}</span>
  </div>;
}

function LayerList({ layers, decidedBy }: { layers: ScreenLayer[]; decidedBy: ScreenResult["decided_by"] | null }) {
  if (!layers.length) return <p className="text-lg text-muted-foreground">Starting the checks…</p>;
  return <ul className="grid gap-3" aria-live="polite">{layers.map((layer, i) => {
    const look = layerLook[layer.status]; const decided = layer.id === decidedBy;
    return <motion.li key={layer.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
      className={cn("flex items-start gap-3 rounded-xl border-2 p-4", decided ? "border-foreground bg-[hsl(46_100%_96%)]" : "border-border", layer.status === "pending" && "border-dashed")}>
      <look.Icon size={30} weight="fill" className={cn("mt-0.5 shrink-0", look.className)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xl font-bold"><span className="sr-only">{look.word}: </span>{layer.label}{decided && <Badge>Decided</Badge>}</p>
        <p className="break-words text-lg text-muted-foreground">{layer.detail}</p>
      </div>
    </motion.li>;
  })}</ul>;
}

function NumberResult({ lookup }: { lookup: NumberCheck & { error?: string } }) {
  if (lookup.status === "invalid") return <Alert variant="destructive" role="alert"><Warning weight="bold" /><AlertDescription>{lookup.error || "Please enter a 10-digit US phone number."}</AlertDescription></Alert>;
  if (lookup.status === "unavailable") return <Alert variant="warn" role="status"><Warning weight="bold" /><AlertDescription>{lookup.detail}</AlertDescription></Alert>;
  if (lookup.status === "reported") return <Alert variant="destructive" className="bg-danger-soft" role="status"><XCircle weight="fill" /><AlertDescription className="grid gap-1">
    <p className="text-xl font-extrabold">Reported to the FTC {lookup.reports} {lookup.reports === 1 ? "time" : "times"}</p>
    <p className="text-foreground">Most recently {lookup.last_reported}, about “{lookup.topic}”{lookup.robocall_reports ? `. ${lookup.robocall_reports} said it was a robocall` : ""}.</p>
    <p className="text-base text-muted-foreground">Reports are complaints, not proof. Scammers can also fake caller ID. Let it go to voicemail.</p>
  </AlertDescription></Alert>;
  return <Alert variant="safe" role="status"><CheckCircle weight="fill" /><AlertDescription className="grid gap-1">
    <p className="text-xl font-extrabold">Not on the FTC complaint list</p>
    <p className="text-base text-muted-foreground">Checked {lookup.from} to {lookup.to}. That doesn&apos;t mean it&apos;s safe: new scam numbers appear every day, and caller ID can be faked.</p>
  </AlertDescription></Alert>;
}

function ContactsCard({ contacts, onChange }: { contacts: TrustedContact[]; onChange: (next: TrustedContact[]) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [number, setNumber] = useState(""); const [problem, setProblem] = useState("");
  function add() {
    const digits = normalizeUsNumber(number);
    if (!name.trim()) { setProblem("Enter their name."); return; }
    if (number.trim() && !digits) { setProblem("Enter a 10-digit US phone number, or leave it blank."); return; }
    onChange(sanitizeContacts([...contacts, { name, phone: digits }])); setName(""); setNumber(""); setProblem("");
    toast.success(`${name.trim()} saved`, { description: "Saved only on this device." });
  }
  function remove(index: number) {
    const removed = contacts[index]; onChange(contacts.filter((_, j) => j !== index));
    toast(`${removed.name} removed`, { action: { label: "Undo", onClick: () => onChange(sanitizeContacts([...contacts])) } });
  }
  return <Collapsible open={open} onOpenChange={setOpen} asChild>
    <Card>
      <CollapsibleTrigger className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl px-6 text-left font-display text-2xl font-extrabold">
        <span className="flex items-center gap-3"><UsersThree size={30} weight="fill" className="text-primary" aria-hidden="true" />Trusted contacts <Badge variant="secondary">{contacts.length}</Badge></span>
        <CaretDown size={26} weight="bold" className={cn("shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="grid gap-4">
          <p className="text-lg text-muted-foreground">If a caller says “It&apos;s Jake” from a number that isn&apos;t Jake&apos;s, CallCanary warns you. Saved only on this device.</p>
          {contacts.length > 0 && <ul className="grid gap-2">{contacts.map((contact, i) => <li key={`${contact.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border-2 p-3">
            <span className="min-w-0"><strong className="block text-xl">{contact.name}</strong><span className="text-lg text-muted-foreground">{contact.phone ? formatUsNumber(contact.phone) : "No number saved"}</span></span>
            <Button variant="outline-danger" size="icon" aria-label={`Remove ${contact.name}`} onClick={() => remove(i)}><Trash weight="bold" /></Button>
          </li>)}</ul>}
          <div className="grid gap-3">
            <Label htmlFor="contact-new-name">Name</Label>
            <Input id="contact-new-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Jake" autoComplete="off" />
            <Label htmlFor="contact-new-phone">Their phone number</Label>
            <Input id="contact-new-phone" type="tel" inputMode="tel" value={number} onChange={event => setNumber(event.target.value)} placeholder="e.g. (210) 555-0147" autoComplete="off" />
            {problem && <p className="text-lg font-bold text-destructive" role="alert">{problem}</p>}
            <Button size="lg" onClick={add}><UserPlus weight="bold" />Add contact</Button>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>;
}

function SampleCalls({ onRun }: { onRun: (sample: ScreenDemo) => void }) {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen} asChild>
    <Card className="border-accent bg-[hsl(47_100%_96%)]">
      <CollapsibleTrigger className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl px-6 text-left font-display text-2xl font-extrabold">
        <span className="flex items-center gap-3"><PlayCircle size={30} weight="fill" className="text-[hsl(40_90%_32%)]" aria-hidden="true" />Try a sample call</span>
        <CaretDown size={26} weight="bold" className={cn("shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <CardContent className="grid gap-3">
          <p className="text-lg text-muted-foreground">Hear a recorded caller answer CallCanary, then watch the real checks run. Uses a sample contact “Jake” at (210) 555-0147.</p>
          {SCREEN_DEMOS.map(sample => <Button key={sample.id} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => onRun(sample)}>
            <PlayCircle weight="fill" className="text-primary" /><span className="grid"><span>{sample.label}</span><span className="text-base font-semibold text-muted-foreground">{sample.phone}</span></span>
          </Button>)}
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>;
}
