"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CheckCircle, Info, Trash, Warning, XCircle } from "@phosphor-icons/react";
import TopBar from "@/components/TopBar";
import Mascot from "@/components/Mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { addHistory, clearHistory, historyEnabled, loadHistory, onHistoryChange, removeHistory, setHistoryEnabled, type HistoryEntry } from "@/lib/history";
import { at, cn } from "@/lib/utils";
import PageHero from "@/components/PageHero";

const look = {
  scam: { Icon: XCircle, word: "Scam", className: "text-danger", border: "border-danger/60" },
  careful: { Icon: Warning, word: "Be careful", className: "text-warn", border: "border-warn" },
  safe: { Icon: CheckCircle, word: "Looked safe", className: "text-safe", border: "border-safe/50" },
  info: { Icon: Info, word: "Checked", className: "text-muted-foreground", border: "border-border" },
} as const;
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
  function remove(entry: HistoryEntry) {
    removeHistory(entry.id);
    toast("Check removed", { action: { label: "Undo", onClick: () => addHistory({ kind: entry.kind, verdict: entry.verdict, title: entry.title, details: entry.details, sample: entry.sample }) } });
  }
  function clearAll() { clearHistory(); setConfirmClear(false); toast.success("History cleared"); }
  function toggle(next: boolean) {
    setHistoryEnabled(next);
    toast(next ? "History is on" : "History is off", { description: next ? "New checks will be saved on this device." : "Saved checks were deleted and nothing new will be saved." });
  }
  return <main className="min-h-dvh">
    <TopBar active="history" />
    <PageHero eyebrow="Your recent checks" title="What CallCanary checked" subtitle="Saved only on this device. Nothing here is uploaded or shared." />
    <div className="relative mx-auto -mt-14 flex max-w-3xl flex-col gap-5 px-4 pb-6">

      {entries !== null && entries.length > 0 && <p
        style={at(3)} className="reveal rounded-2xl border-2 border-lamp bg-coal p-4 text-center text-2xl text-[#f2f6ee] shadow-xl shadow-coal/20">{scams > 0 ? <>CallCanary caught <strong className="text-lamp">{scams} {scams === 1 ? "scam" : "scams"}</strong> for you.</> : <><strong className="text-lamp">{entries.length}</strong> {entries.length === 1 ? "check" : "checks"} saved on this device.</>}</p>}

      {entries !== null && entries.length === 0 && <Card className="reveal shadow-xl shadow-coal/10" style={at(3)}><CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <Mascot mood="sleeping" size="md" />
        <p className="text-xl">{enabled ? "Nothing yet. Calls you screen, numbers and emails you check will show up here." : "History is turned off, so nothing is being saved."}</p>
        <div className="flex flex-wrap justify-center gap-3"><Button asChild><Link href="/screen">Screen a caller</Link></Button><Button asChild variant="secondary"><Link href="/email">Check an email</Link></Button></div>
      </CardContent></Card>}

      {groups.map((group, g) => <section key={group.label} aria-label={group.label} className="reveal grid gap-3" style={at(4 + g)}>
        <h2 className="font-display text-2xl font-extrabold">{group.label}</h2>
        <ul className="grid gap-3">
          <AnimatePresence initial={false}>{group.items.map(entry => { const l = look[entry.verdict];
            return <motion.li key={entry.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
              className={cn("flex items-start gap-3 rounded-2xl border-[3px] bg-card p-4", l.border)}>
              <l.Icon size={34} weight="fill" className={cn("mt-0.5 shrink-0", l.className)} aria-hidden="true" />
              <div className="min-w-0 flex-1 break-words">
                <p className="text-xl font-extrabold leading-snug"><span className="sr-only">{l.word}: </span>{entry.title}</p>
                {entry.details.map((detail, i) => <p key={i} className="text-lg text-muted-foreground">{detail}</p>)}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
                  {new Date(entry.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · <Link className="font-bold text-primary underline-offset-4 hover:underline" href={tool[entry.kind].href}>{tool[entry.kind].label}</Link>
                  {entry.sample && <Badge>Sample</Badge>}
                </p>
              </div>
              <Button variant="outline" size="icon" aria-label={`Remove: ${entry.title}`} onClick={() => remove(entry)}><Trash weight="bold" /></Button>
            </motion.li>; })}</AnimatePresence>
        </ul>
      </section>)}

      <Card><CardContent className="grid gap-4 p-5">
        <div className="flex items-start gap-4">
          <Switch id="history-on" checked={enabled} onCheckedChange={toggle} className="mt-1" />
          <Label htmlFor="history-on" className="leading-snug">Keep a history of my checks on this device</Label>
        </div>
        <p className="text-lg text-muted-foreground">Turning it off also deletes what&apos;s saved. Only short summaries are kept, never recordings, full call words or email text. At most 50 checks.</p>
        {entries !== null && entries.length > 0 && (confirmClear
          ? <div role="alertdialog" aria-label="Confirm clearing history" className="grid gap-3 rounded-xl border-2 border-danger/50 p-4">
              <p className="text-xl font-bold">Delete all {entries.length} saved checks?</p>
              <div className="grid gap-3 sm:grid-cols-2"><Button variant="destructive" size="lg" onClick={clearAll}>Yes, delete all</Button><Button variant="secondary" size="lg" onClick={() => setConfirmClear(false)}>Keep them</Button></div>
            </div>
          : <Button variant="outline-danger" size="lg" onClick={() => setConfirmClear(true)}><Trash weight="bold" />Clear all history</Button>)}
      </CardContent></Card>
    </div>
  </main>;
}
