"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Flag, RotateCcw, Trash2 } from "lucide-react";
import type { EmailResult } from "@/lib/emailAnalysis";
import { saveReport } from "@/lib/emailReports";
import Mascot from "./Mascot";
import RiskMeter from "./RiskMeter";

const banner = {
  safe: { title: "This email looks safe", icon: "✅", className: "verdict-safe" },
  suspicious: { title: "Be careful", icon: "⚠️", className: "verdict-careful" },
  phishing: { title: "PHISHING EMAIL", icon: "⛔", className: "verdict-phishing" },
} as const;
const linkIcon = { safe: "✅", suspicious: "⚠️", malicious: "⛔" } as const;
const linkWord = { safe: "Looks okay", suspicious: "Suspicious", malicious: "Dangerous — don't click" } as const;
const deleteSteps = [
  ["Gmail", "Open the email and tap the trash can at the top."],
  ["Outlook", "Open the email and tap Delete (the trash can)."],
  ["iPhone Mail", "Swipe left on the email in your inbox and tap Trash."],
  ["Yahoo Mail", "Open the email and tap Delete at the bottom."],
];

export default function EmailResultView({ result, onReset }: { result: EmailResult; onReset: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<"idle" | "confirm" | "done">("idle");
  const [report, setReport] = useState<ReturnType<typeof saveReport> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const look = banner[result.level];
  const flagged = result.links.filter(link => link.verdict !== "safe").length;
  return <section className="email-result" aria-labelledby="email-verdict">
    <div className={`verdict-banner ${look.className}`}>
      <Mascot mood={result.level === "phishing" ? "warning" : result.level === "suspicious" ? "concerned" : "alert"} />
      <h2 id="email-verdict" ref={heading} tabIndex={-1}><span aria-hidden="true">{look.icon} </span>{look.title}</h2>
      <p className="verdict-action">{result.recommended_action}</p>
      <RiskMeter score={result.risk_score} label="Email risk" />
      {!result.ai_checked && <p className="verdict-note">CallCanary&apos;s full check wasn&apos;t available right now, so this result comes from the link and sender checks only.</p>}
    </div>

    {(result.typos.length > 0 || result.ai_checked) && <div className="check-card">
      <h3>Spelling mistakes found:</h3>
      {result.typos.length ? <>
        <ul className="typo-list">{result.typos.map((typo, i) => <li key={i}>
          <span className="typo-pair"><del>{typo.typo}</del><span aria-hidden="true"> → </span><span className="sr-only"> should be </span><ins>{typo.correction}</ins></span>
          {typo.why_it_matters && <small>{typo.why_it_matters}</small>}</li>)}</ul>
        <p className="lesson">Real banks and companies proofread their emails. Spelling mistakes are a warning sign.</p>
      </> : <p className="lesson">No spelling mistakes found.</p>}
    </div>}

    <div className="check-card">
      <h3>Link check:</h3>
      {result.links.length === 0 ? <p className="lesson">No links found in this email.</p> : <>
        {flagged > 0 && <p className="lesson">{flagged === 1 ? "1 link is" : `${flagged} links are`} not what {flagged === 1 ? "it seems" : "they seem"}. Don&apos;t click {flagged === 1 ? "it" : "them"}.</p>}
        <ul className="link-cards">{result.links.map((link, i) => <li key={i} className={`link-card link-${link.verdict}`}>
          <button aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span className="link-icon" aria-hidden="true">{linkIcon[link.verdict]}</span>
            <span className="link-lines">
              <span className="link-says">Says: <strong>{link.shown_domain || link.display_text || "(no words shown)"}</strong></span>
              <span className="link-goes">Actually goes to: <strong>{link.actual_domain || link.actual_url}</strong></span>
              <span className="link-word">{linkWord[link.verdict]}</span>
            </span>
            <ChevronDown className="link-chevron" size={28} aria-hidden="true" />
          </button>
          {open === i && <div className="link-detail">
            <p>{link.explanation}</p>
            {link.flags.length > 0 && <ul>{link.flags.map(flag => <li key={flag.code}>{flag.message}</li>)}</ul>}
            {/* Shown as text, never as a clickable link. */}
            <p className="link-full">Full address: <code>{link.actual_url}</code></p>
          </div>}
        </li>)}</ul>
      </>}
    </div>

    {result.sender && <div className="check-card">
      <h3>Sender check:</h3>
      <p className="sender-line">Claims to be: <strong>{result.sender.claimed_brand || result.sender.display_name || "(no name)"}</strong></p>
      <p className="sender-line">Actually sent from: <strong>{result.sender.address || "(unknown)"}</strong> <span aria-label={result.sender.spoofed ? "fake sender" : "sender matches"}>{result.sender.spoofed ? "⛔" : "✅"}</span></p>
      {result.sender.reply_to && result.sender.reply_to !== result.sender.address && <p className="sender-line">Replies go to: <strong>{result.sender.reply_to}</strong></p>}
      <p className="lesson">{result.sender.explanation}</p>
    </div>}

    {result.pressure_tactics.length > 0 && <div className="check-card">
      <h3>Pressure tricks used:</h3>
      <ul className="pressure-list">{result.pressure_tactics.map((tactic, i) => <li key={i}><AlertTriangle size={22} aria-hidden="true" />{tactic}</li>)}</ul>
    </div>}

    <div className="email-actions">
      {deleting === "idle" && <button className="big-action action-danger" onClick={() => setDeleting("confirm")}><Trash2 size={28} />Delete this email</button>}
      {deleting === "confirm" && <div className="confirm-box" role="alertdialog" aria-label="Confirm delete">
        <p>Delete this email?</p>
        <div><button className="big-action action-danger" onClick={() => setDeleting("done")}>Yes, delete it</button>
          <button className="big-action action-plain" onClick={() => setDeleting("idle")}>Keep it</button></div>
      </div>}
      {deleting === "done" && <div className="confirm-box" role="status">
        <p>Good choice. CallCanary can&apos;t reach your inbox, so delete it in your email app:</p>
        <ul>{deleteSteps.map(([app, step]) => <li key={app}><strong>{app}:</strong> {step}</li>)}</ul>
      </div>}
      <button className="big-action action-report" onClick={() => setReport(saveReport(result))}><Flag size={28} />Report &amp; save links</button>
      {report && <div className="confirm-box" role="status">
        <p>{report.saved ? `Saved on this device (${report.count} saved ${report.count === 1 ? "report" : "reports"}). Nothing was sent anywhere.` : "This browser couldn't save the report. Nothing was sent anywhere."}</p>
        <p>To report it yourself:</p>
        <ul><li>Forward the email to <strong>reportphishing@apwg.org</strong>.</li>
          <li>Report it to the FTC at <a href="https://reportfraud.ftc.gov" target="_blank" rel="noreferrer">ReportFraud.ftc.gov</a>.</li>
          <li>In Gmail or Outlook, use “Report phishing” in the email&apos;s menu.</li></ul>
      </div>}
      <button className="big-action action-plain" onClick={onReset}><RotateCcw size={26} />Check another email</button>
    </div>
  </section>;
}
