"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowCounterClockwise, CaretDown, CheckCircle, Flag, Prohibit, Trash, Warning, XCircle } from "@phosphor-icons/react";
import type { EmailResult } from "@/lib/emailAnalysis";
import { saveReport } from "@/lib/emailReports";
import Mascot from "./Mascot";
import RiskMeter from "./RiskMeter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const banner = {
  safe: { title: "This email looks safe", Icon: CheckCircle, className: "bg-safe-soft border-safe text-[hsl(145_60%_18%)]" },
  suspicious: { title: "Be careful", Icon: Warning, className: "bg-warn-soft border-warn text-[hsl(40_90%_18%)]" },
  phishing: { title: "PHISHING EMAIL", Icon: XCircle, className: "alarm-rings border-[hsl(357_80%_26%)] text-white" },
} as const;
const linkLook = {
  safe: { Icon: CheckCircle, word: "Looks okay", badge: "safe", border: "border-safe/50", bg: "bg-safe-soft/60", text: "text-safe" },
  suspicious: { Icon: Warning, word: "Suspicious", badge: "warn", border: "border-warn", bg: "bg-warn-soft/60", text: "text-warn" },
  malicious: { Icon: Prohibit, word: "Dangerous — don't click", badge: "danger", border: "border-danger", bg: "bg-danger-soft", text: "text-danger" },
} as const;
const deleteSteps = [
  ["Gmail", "Open the email and tap the trash can at the top."],
  ["Outlook", "Open the email and tap Delete (the trash can)."],
  ["iPhone Mail", "Swipe left on the email in your inbox and tap Trash."],
  ["Yahoo Mail", "Open the email and tap Delete at the bottom."],
];

export default function EmailResultView({ result, onReset }: { result: EmailResult; onReset: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "done">("idle");
  const [reported, setReported] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const look = banner[result.level];
  const flagged = result.links.filter(link => link.verdict !== "safe").length;
  function report() {
    const saved = saveReport(result); setReported(true);
    if (saved.saved) toast.success("Report saved on this device", { description: `${saved.count} saved ${saved.count === 1 ? "report" : "reports"}. Nothing was sent anywhere.` });
    else toast.error("This browser couldn't save the report", { description: "Nothing was sent anywhere. You can still report it yourself below." });
  }
  return <section className="grid gap-5" aria-labelledby="email-verdict">
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("flex flex-col items-center gap-3 rounded-[28px] border-4 px-5 py-6 text-center", look.className)}>
      <Mascot mood={result.level === "phishing" ? "warning" : result.level === "suspicious" ? "concerned" : "alert"} size="md" />
      <h2 id="email-verdict" ref={heading} tabIndex={-1} className="flex items-center gap-3 text-balance font-display text-4xl font-extrabold leading-tight outline-none sm:text-5xl">
        <look.Icon size={44} weight="fill" aria-hidden="true" className="shrink-0" />{look.title}</h2>
      <p className="text-pretty text-2xl font-semibold leading-snug">{result.recommended_action}</p>
      <div className="w-full max-w-md"><RiskMeter score={result.risk_score} label="Email risk" tone="dark" /></div>
      {!result.ai_checked && <p className="text-lg">CallCanary&apos;s full check wasn&apos;t available right now, so this result comes from the link and sender checks only.</p>}
    </motion.div>

    {(result.typos.length > 0 || result.ai_checked) && <Card><CardHeader className="pb-3"><CardTitle>Spelling mistakes found</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {result.typos.length ? <>
          <ul className="grid divide-y-2">{result.typos.map((typo, i) => <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }} className="grid gap-1 py-3 first:pt-0">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold">
              <del className="text-danger decoration-[3px]">{typo.typo}</del><span aria-hidden="true" className="text-muted-foreground">→</span><span className="sr-only"> should be </span>
              <ins className="rounded-md bg-safe-soft px-2 text-safe no-underline">{typo.correction}</ins></span>
            {typo.why_it_matters && <span className="text-lg text-muted-foreground">{typo.why_it_matters}</span>}</motion.li>)}</ul>
          <p className="rounded-xl bg-muted/70 p-3 text-lg font-semibold">Real banks and companies proofread their emails. Spelling mistakes are a warning sign.</p>
        </> : <p className="text-lg text-muted-foreground">No spelling mistakes found.</p>}
      </CardContent></Card>}

    <Card><CardHeader className="pb-3"><CardTitle>Link check</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {result.links.length === 0 ? <p className="text-lg text-muted-foreground">No links found in this email.</p> : <>
          {flagged > 0 && <p className="text-xl font-bold text-danger">{flagged === 1 ? "1 link is" : `${flagged} links are`} not what {flagged === 1 ? "it seems" : "they seem"}. Don&apos;t click {flagged === 1 ? "it" : "them"}.</p>}
          <ul className="grid gap-3">{result.links.map((link, i) => { const l = linkLook[link.verdict]; const isOpen = open === i;
            return <li key={i} className={cn("overflow-hidden rounded-2xl border-[3px]", l.border, l.bg)}>
              <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring">
                <l.Icon size={40} weight="fill" className={cn("shrink-0", l.text)} aria-hidden="true" />
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="break-words text-xl">Says: <strong>{link.shown_domain || link.display_text || "(no words shown)"}</strong></span>
                  <span className="break-words text-xl">Actually goes to: <strong className={l.text}>{link.actual_domain || link.actual_url}</strong></span>
                  <Badge variant={l.badge} className="w-fit">{l.word}</Badge>
                </span>
                <CaretDown size={28} weight="bold" className={cn("shrink-0 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>{isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-2 border-t-2 border-current/10 px-5 pb-5 pt-3 text-lg">
                  <p>{link.explanation}</p>
                  {link.flags.length > 0 && <ul className="list-disc pl-6">{link.flags.map(flag => <li key={flag.code}>{flag.message}</li>)}</ul>}
                  {/* Shown as text, never as a clickable link. */}
                  <p className="break-all text-base text-muted-foreground">Full address: <code>{link.actual_url}</code></p>
                </div>
              </motion.div>}</AnimatePresence>
            </li>; })}</ul>
        </>}
      </CardContent></Card>

    {result.sender && <Card className={result.sender.spoofed ? "border-danger/50" : undefined}><CardHeader className="pb-3"><CardTitle>Sender check</CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-xl">
        <p>Claims to be: <strong>{result.sender.claimed_brand || result.sender.display_name || "(no name)"}</strong></p>
        <p className="flex flex-wrap items-center gap-2 break-all">Actually sent from: <strong>{result.sender.address || "(unknown)"}</strong>
          {result.sender.spoofed ? <Badge variant="danger">Fake sender</Badge> : <Badge variant="safe">Matches</Badge>}</p>
        {result.sender.reply_to && result.sender.reply_to !== result.sender.address && <p className="break-all">Replies go to: <strong>{result.sender.reply_to}</strong></p>}
        <p className="text-lg text-muted-foreground">{result.sender.explanation}</p>
      </CardContent></Card>}

    {result.pressure_tactics.length > 0 && <Card><CardHeader className="pb-3"><CardTitle>Pressure tricks used</CardTitle></CardHeader>
      <CardContent><ul className="grid gap-2">{result.pressure_tactics.map((tactic, i) => <li key={i} className="flex items-start gap-3 text-xl"><Warning size={26} weight="fill" className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />{tactic}</li>)}</ul></CardContent></Card>}

    <div className="grid gap-3">
      {deleting === "idle" && <Button variant="destructive" size="xl" onClick={() => setDeleting("confirm")}><Trash weight="bold" />Delete this email</Button>}
      {deleting === "confirm" && <Card role="alertdialog" aria-label="Confirm delete"><CardContent className="grid gap-3 p-5">
        <p className="text-2xl font-bold">Delete this email?</p>
        <div className="grid gap-3 sm:grid-cols-2"><Button variant="destructive" size="lg" onClick={() => setDeleting("done")}>Yes, delete it</Button><Button variant="secondary" size="lg" onClick={() => setDeleting("idle")}>Keep it</Button></div>
      </CardContent></Card>}
      {deleting === "done" && <Card role="status"><CardContent className="grid gap-2 p-5 text-lg">
        <p className="text-xl font-bold">Good choice. CallCanary can&apos;t reach your inbox, so delete it in your email app:</p>
        <ul className="grid gap-1">{deleteSteps.map(([app, step]) => <li key={app}><strong>{app}:</strong> {step}</li>)}</ul>
      </CardContent></Card>}
      <Button variant="outline-danger" size="xl" onClick={report}><Flag weight="bold" />Report &amp; save links</Button>
      {reported && <Card role="status"><CardContent className="grid gap-2 p-5 text-lg">
        <p className="text-xl font-bold">To report it yourself:</p>
        <ul className="list-disc space-y-1 pl-6"><li>Forward the email to <strong>reportphishing@apwg.org</strong>.</li>
          <li>Report it to the FTC at <a className="font-bold text-primary underline" href="https://reportfraud.ftc.gov" target="_blank" rel="noreferrer">ReportFraud.ftc.gov</a>.</li>
          <li>In Gmail or Outlook, use “Report phishing” in the email&apos;s menu.</li></ul>
      </CardContent></Card>}
      <Button variant="secondary" size="xl" onClick={onReset}><ArrowCounterClockwise weight="bold" />Check another email</Button>
    </div>
  </section>;
}
