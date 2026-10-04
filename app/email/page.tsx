"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EnvelopeSimple, LinkSimple, MagnifyingGlass, PlayCircle, Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
  return <main className="min-h-dvh">
    <TopBar active="email" />
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      {result ? <EmailResultView result={result} onReset={reset} /> : <>
        <header className="grid gap-2 text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-primary">Got a strange email or text?</p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-tight sm:text-5xl">Check it before you click.</h1>
          <p className="text-pretty text-xl text-muted-foreground">Paste it here. CallCanary checks where every link really goes, looks for spelling mistakes, and spots fake senders.</p>
        </header>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5" role="radiogroup" aria-label="What do you want to check?">
          {([["email", "A whole email", EnvelopeSimple], ["link", "Just a link", LinkSimple]] as const).map(([id, label, Icon]) =>
            <button key={id} role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
              className={cn("relative flex min-h-16 items-center justify-center gap-2 rounded-xl text-xl font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring", mode === id ? "text-[hsl(152_71%_15%)]" : "text-muted-foreground")}>
              {mode === id && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-xl bg-card shadow" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative flex items-center gap-2"><Icon size={26} weight={mode === id ? "fill" : "regular"} aria-hidden="true" />{label}</span>
            </button>)}
        </div>
        <Card><CardContent className="p-5">
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void check(); }}>
            <Label htmlFor="email-input" className="font-display text-2xl font-extrabold">{mode === "email" ? "Paste a suspicious email here" : "Paste a suspicious link here"}</Label>
            {mode === "email"
              ? <textarea id="email-input" value={text} onChange={event => setText(event.target.value)} rows={10} maxLength={50_000} placeholder="Copy the whole email, including who it's from, and paste it here."
                  className="min-h-[280px] w-full resize-y rounded-lg border-[3px] border-input bg-card px-4 py-3 text-xl leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring" />
              : <Input id="email-input" value={text} onChange={event => setText(event.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="e.g. paypa1-secure.ru/verify" />}
            <p className="text-lg text-muted-foreground">Don&apos;t open the link first, just copy it: long-press it on a phone, or right-click on a computer, and choose “Copy link”.</p>
            <Button type="submit" variant="canary" size="xl" disabled={busy || !text.trim()}><MagnifyingGlass weight="bold" />{busy ? `Checking this ${noun}…` : `Check this ${noun}`}</Button>
          </form>
        </CardContent></Card>
        <AnimatePresence>{busy && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 text-center" role="status">
          <Mascot mood="concerned" size="md" /><p className="text-2xl font-bold">CallCanary is reading it carefully…</p></motion.div>}</AnimatePresence>
        {error && <Alert variant="destructive" role="alert"><Warning weight="bold" /><AlertDescription>{error}</AlertDescription></Alert>}
        {!busy && <Button variant="outline" size="lg" onClick={demo} className="justify-self-center"><PlayCircle weight="fill" className="text-primary" />Try a demo phishing email</Button>}
        <p className="text-center text-base text-muted-foreground">The email text is sent to Google&apos;s Gemini to check spelling, sender and pressure tricks. Links are checked by CallCanary itself and are never opened.</p>
      </>}
    </div>
  </main>;
}
