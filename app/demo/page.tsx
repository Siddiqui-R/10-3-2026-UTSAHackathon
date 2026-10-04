"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Mail, Phone, PhoneIncoming, PhoneOff, RefreshCw, ShieldCheck, Volume2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import Mascot from "@/components/Mascot";
import RiskMeter from "@/components/RiskMeter";
import { scoreSignals } from "@/lib/scamSignals";
import { speakWithDeviceVoice } from "@/lib/deviceVoice";

const messages = [
  { id: "delivery", from: "USPS Delivery Support", address: "delivery@usps-redelivery.example", subject: "Your package is on hold", preview: "Pay a small fee today to release your delivery.", body: "Your package could not be delivered. Update your address and pay a 30 cent redelivery fee immediately at usps-redelivery.example. Your delivery will be cancelled today if you do not pay.", risk: true, reasons: ["The sender's address is not the official USPS domain.", "The message pressures you to pay through an unfamiliar link."] },
  { id: "bank", from: "Account Security", address: "security@bank-verify.example", subject: "Urgent: verify your account", preview: "Send your one-time security code to unlock your account.", body: "Your bank account is locked. Reply with the one-time security code we just sent you to restore access. Do not call your bank: our security team is handling this issue.", risk: true, reasons: ["The sender asks you to share a one-time security code.", "They discourage you from checking with your bank directly."] },
  { id: "family", from: "Alex", address: "alex@family.example", subject: "Sunday lunch?", preview: "I'll bring soup. See you at noon!", body: "Hi! Are we still on for Sunday lunch? I'll bring soup. See you at noon! Love, Alex.", risk: false, reasons: ["This example does not ask for money, passwords, or security codes."] },
];
const callerLines = [
  "Hello, this is Officer Daniels from the IRS.",
  "There is a warrant for your arrest for unpaid taxes.",
  "You must pay immediately with Apple gift cards to avoid arrest.",
  "Stay on the line and do not tell anyone. Time is running out.",
];
const callReasons = ["The caller asks you to pay with gift cards.", "They threaten arrest and tell you to keep the payment secret."];
type CallState = "idle" | "ringing" | "connected" | "warning" | "ended" | "blocked" | "trusted";

export default function ApplicationDemo() {
  const [gmail, setGmail] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [spam, setSpam] = useState<string[]>([]);
  const [call, setCall] = useState<CallState>("idle");
  const [lineCount, setLineCount] = useState(0);
  const [notice, setNotice] = useState("Ready for a walkthrough.");
  const [speaking, setSpeaking] = useState(false);
  const player = useRef<HTMLAudioElement>();
  const voiceRequest = useRef<AbortController>();
  const audioUrl = useRef<string>();
  const message = messages.find(item => item.id === selected);
  const signals = scoreSignals(callerLines.slice(0, lineCount).join(" "));

  useEffect(() => {
    if (call !== "connected") return;
    const timer = window.setInterval(() => setLineCount(count => Math.min(count + 1, callerLines.length)), 1800);
    return () => window.clearInterval(timer);
  }, [call]);
  useEffect(() => {
    if (call === "connected" && lineCount === callerLines.length) {
      setCall("warning"); setNotice("Demo: CallCanary interrupted a suspected scam call.");
    }
  }, [call, lineCount]);
  useEffect(() => () => {
    voiceRequest.current?.abort(); player.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }, []);

  function stopVoice() {
    voiceRequest.current?.abort(); player.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = undefined; setSpeaking(false);
  }
  function reset() {
    stopVoice(); setGmail(false); setSelected(null); setSpam([]); setCall("idle"); setLineCount(0); setNotice("Ready for a walkthrough.");
  }
  async function hearWarning(reasons: string[]) {
    stopVoice(); const controller = new AbortController(); voiceRequest.current = controller; setSpeaking(true);
    const finished = () => { if (!controller.signal.aborted) setSpeaking(false); };
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "scam", reasons }), signal: controller.signal });
      if (!response.ok) throw new Error("Voice unavailable");
      const blob = await response.blob(); if (controller.signal.aborted) return;
      audioUrl.current = URL.createObjectURL(blob); player.current = new Audio(audioUrl.current);
      player.current.onended = player.current.onerror = finished;
      await player.current.play();
    } catch {
      if (!controller.signal.aborted && !speakWithDeviceVoice(`This example looks like a scam. ${reasons.join(" ")}`, { onStart: () => {}, onEnd: finished, onError: finished })) finished();
    }
  }
  function beginCall() {
    stopVoice(); setLineCount(0); setCall("ringing"); setNotice("Demo: an incoming call is ringing.");
  }
  function endCall(block = false) {
    stopVoice(); setCall(block ? "blocked" : "ended"); setNotice(block ? "Demo: caller blocked. No phone settings were changed." : "Demo: call ended.");
  }

  return <main className="app-shell">
    <TopBar active="demo"><span className="connection-pill">Demo mode</span></TopBar>
    <section className="application-demo">
      <div className="demo-heading"><div><p className="eyebrow">One guardian for your inbox and your calls.</p><h1>Your everyday safety companion.</h1>
        <p>Explore how CallCanary could work as a connected application.</p></div><button className="demo-control" onClick={reset}><RefreshCw size={20} />Reset demo</button></div>
      <div className="simulation-note"><ShieldCheck size={22} /><span><strong>Interactive simulation.</strong> Gmail, calls, messages, and safety actions are sample data. No real accounts connect, calls are placed, or emails are changed.</span></div>
      <div className="demo-workspace">
        <section className="integration-card" aria-label="Gmail demo">
          <div className="integration-header"><div className="integration-title"><Mail size={26} /><h2>Gmail inbox</h2></div><span className={`demo-status ${gmail ? "demo-status-on" : ""}`}>{gmail ? "Connected · demo" : "Not connected"}</span></div>
          {!gmail ? <div className="integration-empty"><Mail size={46} /><h3>Bring your inbox under our wing.</h3><p>Preview automatic scam checks as new messages arrive.</p>
            <button className="demo-primary" onClick={() => { setGmail(true); setNotice("Demo inbox connected. Three sample messages loaded."); }}>Connect Gmail (demo)</button></div>
          : <><div className="demo-account"><span>Sample inbox · demo.inbox@example.com</span><button onClick={() => { stopVoice(); setGmail(false); setSelected(null); }}>Disconnect</button></div>
            <div className="inbox-toolbar"><strong>Inbox <span>{messages.length - spam.length}</span></strong><button className="demo-control" onClick={() => setNotice("Demo inbox synced. Your real Gmail was not accessed.")}><RefreshCw size={17} />Sync demo inbox</button></div>
            <div className="demo-inbox">{messages.filter(item => !spam.includes(item.id)).map(item => <button key={item.id} className={`demo-message ${selected === item.id ? "demo-message-selected" : ""}`} onClick={() => { stopVoice(); setSelected(item.id); }}>
              <div><strong>{item.from}</strong><span className={item.risk ? "email-risk-tag" : "email-safe-tag"}>{item.risk ? "Flagged" : "No warning signs"}</span></div><b>{item.subject}</b><p>{item.preview}</p></button>)}</div>
            {message && !spam.includes(message.id) && <article className="demo-email-detail"><h3>{message.subject}</h3><p className="sample-sender">From: {message.address}</p><p>{message.body}</p>
              <div className={`demo-email-verdict ${message.risk ? "demo-verdict-risk" : ""}`}><strong>{message.risk ? "This sample looks like phishing." : "No warning signs in this example."}</strong><ul>{message.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>
              {message.risk && <div className="demo-action-row"><button className="demo-danger" onClick={() => { stopVoice(); setSpam(items => [...items, message.id]); setSelected(null); setNotice("Demo: email moved to spam and sender blocked. Your real inbox is unchanged."); }}><Ban size={18} />Report spam & block (demo)</button><button className="demo-control" disabled={speaking} onClick={() => void hearWarning(message.reasons)}><Volume2 size={18} />Hear why</button></div>}
            </article>}
            <p className="integration-footnote">{spam.length} sample {spam.length === 1 ? "message" : "messages"} moved to demo spam.</p></>}
        </section>
        <section className="integration-card phone-demo-card" aria-label="Phone call demo">
          <div className="integration-header"><div className="integration-title"><Phone size={25} /><h2>Phone protection</h2></div><span className="demo-status demo-status-on">Phone linked · demo</span></div>
          <div className="demo-phone">
            <div className="demo-phone-top"><ShieldCheck size={17} />CallCanary phone simulator<span>Demo</span></div>
            {call === "ringing" ? <div className="demo-call-screen"><PhoneIncoming size={46} /><p>Incoming call · simulated</p><h3>Unknown caller</h3><p>+1 (210) 555-0142</p><div className="demo-action-row"><button className="demo-primary" onClick={() => { setCall("connected"); setNotice("Demo: call answered. Scripted captions are playing."); }}><Phone size={20} />Answer</button><button className="demo-danger" onClick={() => endCall()}><PhoneOff size={20} />Decline</button></div></div>
            : call === "trusted" ? <div className="demo-call-screen"><Phone size={46} /><p>Outgoing call · simulated</p><h3>Alex · trusted contact</h3><p>Connecting in the demo…</p><button className="demo-danger" onClick={() => endCall()}><PhoneOff size={20} />End demo call</button></div>
            : <><div className="demo-call-screen"><Mascot mood={speaking ? "speaking" : call === "warning" ? "warning" : call === "connected" ? "alert" : "sleeping"} />
              <h3>{call === "connected" ? "CallCanary is listening." : call === "warning" ? "This is a scam example." : call === "blocked" ? "Caller blocked in demo." : call === "ended" ? "Demo call ended." : "Ready when the phone rings."}</h3>
              <p>{call === "connected" ? `Unknown caller · 00:${String(lineCount * 2).padStart(2, "0")}` : "Simulated phone connection"}</p></div>
              {lineCount > 0 && <><div className="demo-captions" aria-label="Scripted call captions" aria-live="polite">{callerLines.slice(0, lineCount).map((line, index) => <p key={line}><strong>Caller</strong> {line}</p>)}</div><RiskMeter score={signals.score} label="Demo phrase score" signals /></>}
              {call === "warning" && <div className="demo-call-warning" role="alert"><strong><AlertTriangle size={21} />CallCanary stepped in.</strong><ul>{callReasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p>Hang up. Don&apos;t send money or share codes.</p><button className="demo-control" disabled={speaking} onClick={() => void hearWarning(callReasons)}><Volume2 size={20} />{speaking ? "Speaking…" : "Hear the mascot explain"}</button></div>}
              {(call === "connected" || call === "warning") && <div className="demo-action-row"><button className="demo-danger" onClick={() => endCall()}><PhoneOff size={20} />Hang up</button><button className="demo-control" onClick={() => endCall(true)}><Ban size={20} />Block caller (demo)</button></div>}
              {(call === "idle" || call === "ended" || call === "blocked") && <div className="demo-action-row"><button className="demo-primary" onClick={beginCall}><PhoneIncoming size={20} />Simulate scam call</button><button className="demo-control" onClick={() => { stopVoice(); setLineCount(0); setCall("trusted"); setNotice("Demo: calling Alex. No actual call is placed."); }}><Phone size={20} />Call Alex (demo)</button></div>}
            </>}
          </div>
          <p className="integration-footnote">Scripted captions and verdicts make the walkthrough repeatable. This screen does not use your microphone or telephone.</p>
        </section>
      </div>
      <div className="demo-activity" role="status"><CheckCircle2 size={22} /><span>{notice}</span></div>
    </section>
  </main>;
}
