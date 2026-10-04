"use client";
import { useRef, useState } from "react";
import { AlertTriangle, Link2, Mail, Search } from "lucide-react";
import TopBar from "@/components/TopBar";
import Mascot from "@/components/Mascot";
import EmailResultView from "@/components/EmailResultView";
import type { EmailResult } from "@/lib/emailAnalysis";
import { DEMO_PHISHING_EMAIL } from "@/lib/demoTranscripts";
import { addHistory } from "@/lib/history";

export default function EmailCheck() {
  const [mode, setMode] = useState<"email" | "link">("email");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EmailResult | null>(null);
  const request = useRef<AbortController>();
  async function check(emailText = text) {
    if (!emailText.trim() || busy) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/analyze-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailText }), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The email check could not finish. Please try again.");
      if (!controller.signal.aborted) {
        const checked = data as EmailResult;
        setResult(checked);
        const dangerous = checked.links.filter(link => link.verdict !== "safe").length;
        addHistory({ kind: "email", verdict: checked.level === "phishing" ? "scam" : checked.level === "suspicious" ? "careful" : "safe", sample: emailText === DEMO_PHISHING_EMAIL,
          title: `Checked ${mode === "link" ? "a link" : "an email"}: ${checked.level === "phishing" ? "phishing" : checked.level === "suspicious" ? "be careful" : "looks safe"}`,
          details: [checked.sender?.address ? `From ${checked.sender.address}${checked.sender.spoofed ? " (fake sender)" : ""}` : "",
            checked.links.length ? `${checked.links.length} ${checked.links.length === 1 ? "link" : "links"}, ${dangerous} not what ${dangerous === 1 ? "it seems" : "they seem"}` : "",
            checked.typos.length ? `${checked.typos.length} spelling ${checked.typos.length === 1 ? "mistake" : "mistakes"}` : ""] });
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The email check could not finish. Please try again.");
    } finally { if (request.current === controller) setBusy(false); }
  }
  function reset() { request.current?.abort(); setResult(null); setText(""); setError(""); setBusy(false); }
  function demo() { setMode("email"); setText(DEMO_PHISHING_EMAIL); void check(DEMO_PHISHING_EMAIL); }
  const noun = mode === "email" ? "email" : "link";
  return <main className="app-shell">
    <TopBar active="email" />
    <section className="home-content email-content">
      {result ? <EmailResultView result={result} onReset={reset} /> : <>
        <div className="intro-copy"><p className="eyebrow">Got a strange email or text?</p>
          <h1>Check it before you click.</h1>
          <p className="intro-subtitle">Paste it here. CallCanary checks where every link really goes, looks for spelling mistakes, and spots fake senders.</p></div>
        <div className="mode-switch" role="radiogroup" aria-label="What do you want to check?">
          <button role="radio" aria-checked={mode === "email"} className={mode === "email" ? "mode-on" : ""} onClick={() => setMode("email")}><Mail size={24} />A whole email</button>
          <button role="radio" aria-checked={mode === "link"} className={mode === "link" ? "mode-on" : ""} onClick={() => setMode("link")}><Link2 size={24} />Just a link</button>
        </div>
        <form className="email-form" onSubmit={event => { event.preventDefault(); void check(); }}>
          <label htmlFor="email-input">{mode === "email" ? "Paste a suspicious email here" : "Paste a suspicious link here"}</label>
          {mode === "email"
            ? <textarea id="email-input" value={text} onChange={event => setText(event.target.value)} rows={10} maxLength={50_000} placeholder="Copy the whole email, including who it's from, and paste it here." />
            : <input id="email-input" value={text} onChange={event => setText(event.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="e.g. paypa1-secure.ru/verify" />}
          <p className="form-hint">Don&apos;t open the link first — just copy it. Long-press it on a phone, or right-click on a computer, and choose “Copy link”.</p>
          <button className="answer-button" type="submit" disabled={busy || !text.trim()}><Search size={28} />{busy ? `Checking this ${noun}…` : `Check this ${noun}`}</button>
        </form>
        {busy && <div className="checking-card" role="status"><Mascot mood="concerned" /><p>CallCanary is reading it carefully…</p></div>}
        {error && <div className="error-message" role="alert"><AlertTriangle size={24} /><p>{error}</p></div>}
        {!busy && <button className="demo-link" onClick={demo}>Try a demo phishing email</button>}
        <p className="footer-note">The email text is sent to Google&apos;s Gemini to check spelling, sender and pressure tricks. Links are checked by CallCanary itself and are never opened.</p>
      </>}
    </section>
  </main>;
}
