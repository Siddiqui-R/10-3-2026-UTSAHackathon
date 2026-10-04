"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import Mascot from "@/components/Mascot";
import { clearHistory, historyEnabled, loadHistory, onHistoryChange, removeHistory, setHistoryEnabled, type HistoryEntry } from "@/lib/history";

const icon = { scam: "⛔", careful: "⚠️", safe: "✅", info: "ℹ️" } as const;
const word = { scam: "Scam", careful: "Be careful", safe: "Looked safe", info: "Checked" } as const;
const tool = { screen: { href: "/screen", label: "Screen a caller" }, number: { href: "/screen", label: "Number check" }, email: { href: "/email", label: "Check an email" }, call: { href: "/", label: "Listen to a call" } } as const;

function dayLabel(date: Date) {
  const today = new Date(); const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function RecentChecks() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const refresh = () => { setEntries(loadHistory()); setEnabled(historyEnabled()); };
    refresh();
    return onHistoryChange(refresh);
  }, []);
  const groups = (entries || []).reduce<{ label: string; items: HistoryEntry[] }[]>((list, entry) => {
    const label = dayLabel(new Date(entry.at));
    const last = list.at(-1);
    if (last?.label === label) last.items.push(entry); else list.push({ label, items: [entry] });
    return list;
  }, []);
  const scams = (entries || []).filter(entry => entry.verdict === "scam" && !entry.sample).length;
  return <main className="app-shell">
    <TopBar active="history" />
    <section className="home-content email-content">
      <div className="intro-copy"><p className="eyebrow">Your recent checks</p>
        <h1>What CallCanary checked</h1>
        <p className="intro-subtitle">Saved only on this device. Nothing here is uploaded or shared.</p></div>

      {entries !== null && entries.length > 0 && scams > 0 && <p className="history-summary">CallCanary caught <strong>{scams} {scams === 1 ? "scam" : "scams"}</strong> for you.</p>}

      {entries !== null && entries.length === 0 && <div className="check-card history-empty">
        <Mascot mood="sleeping" />
        <p>{enabled ? "Nothing yet. Calls you screen, numbers and emails you check will show up here." : "History is turned off, so nothing is being saved."}</p>
        <div className="history-links"><Link href="/screen">Screen a caller</Link><Link href="/email">Check an email</Link></div>
      </div>}

      {groups.map(group => <section key={group.label} className="history-day" aria-label={group.label}>
        <h2>{group.label}</h2>
        <ul className="history-list">{group.items.map(entry => <li key={entry.id} className={`history-item history-${entry.verdict}`}>
          <span className="history-icon" aria-hidden="true">{icon[entry.verdict]}</span>
          <div className="history-body">
            <p className="history-title"><span className="sr-only">{word[entry.verdict]}: </span>{entry.title}</p>
            {entry.details.map((detail, i) => <p key={i} className="history-detail">{detail}</p>)}
            <p className="history-meta">
              {new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · <Link href={tool[entry.kind].href}>{tool[entry.kind].label}</Link>
              {entry.sample && <span className="history-sample">Sample</span>}
            </p>
          </div>
          <button className="history-remove" aria-label={`Remove: ${entry.title}`} onClick={() => removeHistory(entry.id)}><Trash2 size={22} /></button>
        </li>)}</ul>
      </section>)}

      <div className="check-card history-settings">
        <label className="history-toggle">
          <input type="checkbox" checked={enabled} onChange={event => setHistoryEnabled(event.target.checked)} />
          <span>Keep a history of my checks on this device</span>
        </label>
        <p className="form-hint">Turning it off also deletes what&apos;s saved. Only short summaries are kept — never recordings, full call words or email text. At most 50 checks.</p>
        {entries !== null && entries.length > 0 && (confirmClear
          ? <div className="confirm-box" role="alertdialog" aria-label="Confirm clearing history"><p>Delete all {entries.length} saved checks?</p>
              <div><button className="big-action action-danger" onClick={() => { clearHistory(); setConfirmClear(false); }}>Yes, delete all</button>
                <button className="big-action action-plain" onClick={() => setConfirmClear(false)}>Keep them</button></div></div>
          : <button className="big-action action-report" onClick={() => setConfirmClear(true)}><Trash2 size={24} />Clear all history</button>)}
      </div>
    </section>
  </main>;
}
