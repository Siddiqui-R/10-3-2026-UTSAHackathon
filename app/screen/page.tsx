"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, Hash, PhoneIncoming, PhoneOff, RotateCcw, Square, Volume2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import Mascot, { type MascotMood } from "@/components/Mascot";
import SafetyActions from "@/components/SafetyActions";
import type { NumberCheck } from "@/lib/reportedNumbers";
import type { ScreenLayer, ScreenResult } from "@/lib/screening";
import { SCREEN_GOODBYE, SCREEN_GREETING } from "@/lib/screening";
import { speakWithDeviceVoice } from "@/lib/deviceVoice";

type Stage = "idle" | "greeting" | "recording" | "checking" | "done";
const MAX_REPLY_MS = 20_000;
const NO_SPEECH_MS = 8_000;
const END_SILENCE_MS = 2_500;
const SPEECH_LEVEL = 0.02;
const banner = {
  scam: { className: "verdict-phishing", icon: "⛔" },
  careful: { className: "verdict-careful", icon: "⚠️" },
  safe: { className: "verdict-safe", icon: "✅" },
} as const;
const layerIcon: Record<ScreenLayer["status"], string> = { flagged: "⛔", clear: "✅", skipped: "—", unavailable: "…" };

async function fetchVoice(script: "greeting" | "goodbye") {
  const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script }) });
  if (!response.ok) throw new Error("voice unavailable");
  return URL.createObjectURL(await response.blob());
}
/** Play the canary's line; falls back to the device voice. Resolves when it finishes. */
function playLine(url: string | undefined, text: string) {
  return new Promise<void>(resolve => {
    const viaDevice = () => { if (!speakWithDeviceVoice(text, { onStart: () => {}, onEnd: () => resolve(), onError: () => resolve() })) resolve(); };
    if (!url) { viaDevice(); return; }
    const audio = new Audio(url);
    audio.onended = () => resolve(); audio.onerror = viaDevice;
    audio.play().catch(viaDevice);
  });
}

export default function ScreenCaller() {
  const [stage, setStage] = useState<Stage>("idle");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<(NumberCheck & { error?: string }) | null>(null);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [error, setError] = useState("");
  const [heard, setHeard] = useState(false);
  const [goodbye, setGoodbye] = useState<"idle" | "playing" | "done">("idle");
  const greetingUrl = useRef<string>();
  const cancel = useRef<() => void>(() => {});
  // Prepare the greeting early so it plays right after the tap (browsers block late autoplay).
  useEffect(() => {
    let alive = true;
    void fetchVoice("greeting").then(url => { if (alive) greetingUrl.current = url; else URL.revokeObjectURL(url); }).catch(() => {});
    return () => { alive = false; cancel.current(); if (greetingUrl.current) URL.revokeObjectURL(greetingUrl.current); };
  }, []);

  async function checkNumber() {
    setLooking(true); setLookup(null);
    try { setLookup(await (await fetch(`/api/check-number?phone=${encodeURIComponent(phone)}`)).json()); }
    catch { setLookup({ status: "unavailable", number: phone, detail: "The check could not finish. Please try again." }); }
    finally { setLooking(false); }
  }

  async function answer() {
    setError(""); setResult(null); setHeard(false); setGoodbye("idle");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setError("CallCanary needs the microphone to hear the caller. Allow microphone access and try again."); return; }
    let stopped = false;
    const release = () => { stream.getTracks().forEach(track => track.stop()); };
    cancel.current = () => { stopped = true; release(); window.speechSynthesis?.cancel(); };
    setStage("greeting");
    await playLine(greetingUrl.current, SCREEN_GREETING);
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
    setStage("checking");
    const form = new FormData();
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    form.append("audio", blob, blob.type.includes("mp4") ? "reply.mp4" : "reply.webm");
    if (phone.trim()) form.append("phone", phone);
    try {
      const response = await fetch("/api/screen", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The screen could not finish.");
      setResult(data); setStage("done");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The screen could not finish."); setStage("idle"); }
  }
  const stopRecording = useRef<() => void>(() => {});

  async function sayGoodbye() {
    setGoodbye("playing");
    let url: string | undefined;
    try { url = await fetchVoice("goodbye"); } catch { url = undefined; }
    await playLine(url, SCREEN_GOODBYE);
    if (url) URL.revokeObjectURL(url);
    setGoodbye("done");
  }
  function reset() { cancel.current(); setStage("idle"); setResult(null); setError(""); setGoodbye("idle"); }

  const mood: MascotMood = stage === "greeting" ? "speaking" : stage === "recording" ? "alert" : stage === "checking" ? "concerned"
    : result?.verdict === "scam" ? "warning" : result?.verdict === "careful" ? "concerned" : stage === "done" ? "alert" : "sleeping";
  return <main className="app-shell">
    <TopBar active="screen" />
    <section className="home-content email-content">
      {stage !== "done" && <div className="intro-copy"><p className="eyebrow">A call from a number you don&apos;t know?</p>
        <h1>Let CallCanary answer first.</h1>
        <p className="intro-subtitle">It asks the caller who they are and why they&apos;re calling, then tells you whether to talk to them.</p></div>}

      {stage === "idle" && <>
        <div className="check-card screen-number">
          <label htmlFor="caller-number"><Hash size={22} aria-hidden="true" /> Caller&apos;s number (optional)</label>
          <input id="caller-number" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={event => { setPhone(event.target.value); setLookup(null); }} placeholder="e.g. (210) 555-0100" />
          <button className="big-action action-plain" disabled={!phone.trim() || looking} onClick={() => void checkNumber()}>{looking ? "Checking…" : "Check this number"}</button>
          {lookup && <NumberResult lookup={lookup} />}
        </div>
        <div className="check-card">
          <h3>How it works</h3>
          <ol className="screen-steps"><li>Answer the call and put it on <strong>speaker</strong>. Don&apos;t say anything yet.</li>
            <li>Hold your phone near this screen and tap <strong>Answer with CallCanary</strong>.</li>
            <li>CallCanary greets the caller and listens to their answer.</li></ol>
        </div>
        <button className="answer-button" onClick={() => void answer()}><PhoneIncoming size={30} />Answer with CallCanary</button>
        <p className="form-hint">The caller&apos;s reply is sent to ElevenLabs to turn it into words and to Google&apos;s Gemini to judge it. Nothing is saved.</p>
      </>}

      {(stage === "greeting" || stage === "recording" || stage === "checking") && <div className="screen-live" role="status" aria-live="polite">
        <Mascot mood={mood} />
        <h2>{stage === "greeting" ? "CallCanary is greeting the caller…" : stage === "recording" ? (heard ? "Listening to the caller…" : "Waiting for the caller to answer…") : "Checking what they said…"}</h2>
        {stage === "greeting" && <p className="lesson">“{SCREEN_GREETING}”</p>}
        {stage === "recording" && <button className="big-action action-plain" onClick={() => stopRecording.current()}><Square size={24} />They&apos;re done talking</button>}
        <button className="big-action action-report" onClick={reset}>Cancel</button>
      </div>}

      {error && <div className="error-message" role="alert"><AlertTriangle size={24} /><p>{error}</p></div>}

      {stage === "done" && result && <ScreenResultView result={result} mood={mood} goodbye={goodbye} onGoodbye={() => void sayGoodbye()} onReset={reset} />}
    </section>
  </main>;
}

function NumberResult({ lookup }: { lookup: NumberCheck & { error?: string } }) {
  if (lookup.status === "invalid") return <p className="lesson" role="alert">{lookup.error || "Please enter a 10-digit US phone number."}</p>;
  if (lookup.status === "unavailable") return <p className="lesson" role="status">{lookup.detail}</p>;
  if (lookup.status === "reported") return <div className="number-result number-reported" role="status">
    <p><strong>⛔ Reported to the FTC {lookup.reports} {lookup.reports === 1 ? "time" : "times"}</strong></p>
    <p>Most recently {lookup.last_reported}, about “{lookup.topic}”{lookup.robocall_reports ? `. ${lookup.robocall_reports} said it was a robocall` : ""}.</p>
    <p className="form-hint">Reports are complaints, not proof. Scammers can also fake caller ID. Let it go to voicemail.</p>
  </div>;
  return <div className="number-result number-clear" role="status">
    <p><strong>Not on the FTC complaint list</strong> ({lookup.from} to {lookup.to}).</p>
    <p className="form-hint">That doesn&apos;t mean it&apos;s safe: new scam numbers appear every day, and caller ID can be faked.</p>
  </div>;
}

function ScreenResultView({ result, mood, goodbye, onGoodbye, onReset }: { result: ScreenResult; mood: MascotMood; goodbye: "idle" | "playing" | "done"; onGoodbye: () => void; onReset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const look = banner[result.verdict];
  const analysis = { risk_score: 90, level: "scam" as const, scam_type: "other" as const, reasons: [result.explanation], red_flags: [] };
  return <section className="email-result" aria-labelledby="screen-verdict">
    <div className={`verdict-banner ${look.className}`}>
      <Mascot mood={mood} />
      <h2 id="screen-verdict" ref={heading} tabIndex={-1}><span aria-hidden="true">{look.icon} </span>{result.headline}</h2>
      <p className="verdict-action">{result.explanation}</p>
    </div>
    {(result.stated_name || result.stated_reason) && <div className="check-card">
      <h3>The caller said:</h3>
      {result.stated_name && <p className="sender-line">Name: <strong>{result.stated_name}</strong></p>}
      {result.stated_reason && <p className="sender-line">Reason: <strong>{result.stated_reason}</strong></p>}
    </div>}
    {result.red_flags.length > 0 && <div className="check-card"><h3>Warning signs:</h3>
      <ul className="pressure-list">{result.red_flags.map((flag, i) => <li key={i}><AlertTriangle size={22} aria-hidden="true" />{flag}</li>)}</ul></div>}
    <div className="check-card">
      <h3>How CallCanary checked:</h3>
      <ul className="layer-list">{result.layers.map(layer => <li key={layer.id} className={layer.id === result.decided_by ? "layer-decided" : ""}>
        <span className="layer-icon" aria-hidden="true">{layerIcon[layer.status]}</span>
        <span><strong>{layer.label}</strong>{layer.id === result.decided_by && <em className="decided-badge">Decided</em>}<small>{layer.detail}</small></span>
      </li>)}</ul>
    </div>
    <div className="email-actions">
      {result.verdict === "safe" ? <div className="confirm-box" role="status"><p><CheckCircle2 size={22} aria-hidden="true" /> You can talk to them now.</p><p>Still: never send money or share codes on a call you didn&apos;t expect.</p></div> : <>
        <button className="big-action action-danger" disabled={goodbye === "playing"} onClick={onGoodbye}><Volume2 size={28} />{goodbye === "playing" ? "Saying goodbye…" : "Have CallCanary say goodbye"}</button>
        {goodbye === "done" && <div className="confirm-box" role="status"><p><PhoneOff size={22} aria-hidden="true" /> Now hang up on your phone.</p></div>}
        {result.verdict === "scam" && <SafetyActions result={analysis} />}
      </>}
      {result.verdict !== "safe" && <p className="form-hint"><CircleSlash size={18} aria-hidden="true" /> If they really know you, they can leave a voicemail or call back.</p>}
      <button className="big-action action-plain" onClick={onReset}><RotateCcw size={26} />Screen another call</button>
    </div>
  </section>;
}
