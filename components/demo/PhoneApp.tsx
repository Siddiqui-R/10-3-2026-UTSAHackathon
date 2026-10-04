"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, BatteryFull, Bell, CaretRight, ChatCircleText, CheckCircle, CellSignalFull, ClockCounterClockwise, EnvelopeSimple, Globe, House, LockSimple,
  PhoneDisconnect, PhoneIncoming, PhoneX, Prohibit, ShieldCheck, SpeakerHigh, Spinner, Warning, WifiHigh, XCircle } from "@phosphor-icons/react";
import Mascot from "@/components/Mascot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brandInfo, lookalikeBrand, type LinkFinding } from "@/lib/linkCheck";
import type { ScreenLayer } from "@/lib/screening";
import { cn } from "@/lib/utils";
import type { DemoApp, MailItem } from "./useDemoApp";
import LiveCallScreen from "./LiveCallScreen";
import { DEMO_SITES, DEMO_TEXT } from "@/lib/demoScenario";

const tabs = [
  { id: "home", label: "Home", Icon: House }, { id: "inbox", label: "Inbox", Icon: EnvelopeSimple }, { id: "calls", label: "Calls", Icon: PhoneIncoming },
  { id: "web", label: "Web", Icon: Globe }, { id: "blocked", label: "Blocked", Icon: Prohibit },
] as const;
const statusLook = {
  new: { label: "Waiting", className: "bg-muted text-muted-foreground" },
  scanning: { label: "Checking…", className: "bg-lamp/30 text-[hsl(40_90%_25%)]" },
  scam: { label: "Phishing", className: "bg-danger text-white" },
  careful: { label: "Be careful", className: "bg-warn-soft text-warn" },
  safe: { label: "Safe", className: "bg-safe-soft text-safe" },
} as const;

export default function PhoneApp({ app, demoChip = true }: { app: DemoApp; demoChip?: boolean }) {
  const open = app.mail.find(m => m.id === app.openId);
  const tabBadge = { inbox: app.mail.filter(m => m.folder === "scam").length + (app.text.status === "scam" ? 1 : 0), blocked: app.blocked.length } as Record<string, number>;
  return <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground">
    {/* Status bar */}
    <div className="z-20 flex h-11 shrink-0 items-center justify-between bg-coal-2 px-6 text-[13px] font-bold text-white">
      <span className="tabular-nums">9:41</span>
      {demoChip ? <span className="rounded-full bg-lamp px-2 py-0.5 text-[11px] font-extrabold tracking-[0.12em] text-coal">DEMO</span> : <span />}
      <span className="flex items-center gap-1"><CellSignalFull size={16} weight="fill" /><WifiHigh size={16} weight="bold" /><BatteryFull size={20} weight="fill" /></span>
    </div>
    {/* App header */}
    <div className="mine z-10 shrink-0 px-5 pb-4 pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-xl font-extrabold [font-stretch:90%]"><span className="grid size-8 place-items-center rounded-lg bg-lamp text-coal"><ShieldCheck size={20} weight="fill" /></span>CallCanary</span>
        <span className="flex items-center gap-1.5 rounded-full bg-safe/25 px-3 py-1 text-sm font-bold text-[#a8f0c0]"><span className="size-2 rounded-full bg-[#34c759]" />Protected</span>
      </div>
    </div>
    {/* Screen */}
    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={open ? `mail-${open.id}` : `${app.tab}-${app.inboxView}`} initial={{ opacity: 0, x: open ? 24 : 0, y: open ? 0 : 8 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="p-4">
          {open ? <EmailDetail item={open} app={app} /> : app.tab === "home" ? <Home app={app} /> : app.tab === "inbox" ? <Inbox app={app} /> : app.tab === "calls" ? <Calls app={app} /> : app.tab === "web" ? <Web app={app} /> : <Blocked app={app} />}
        </motion.div>
      </AnimatePresence>
    </div>
    {/* In-app tab bar */}
    <nav className="z-10 grid shrink-0 grid-cols-5 border-t border-white/10 bg-coal px-1 pb-5 pt-1.5" aria-label="Demo app tabs">
      {tabs.map(({ id, label, Icon }) => { const on = app.tab === id && !open; return <button key={id} onClick={() => { app.setOpenId(null); app.setTab(id); }}
        className={cn("relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold", on ? "bg-lamp text-coal" : "text-[#c9d6c4]")} aria-current={on ? "page" : undefined}>
        <Icon size={24} weight={on ? "fill" : "regular"} aria-hidden="true" />{label}
        {!!tabBadge[id] && <span className="absolute right-2 top-0.5 grid min-w-5 place-items-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-extrabold text-white">{tabBadge[id]}</span>}
      </button>; })}
    </nav>
    {/* Notification banner */}
    <AnimatePresence>{app.note && <motion.div key={app.note.id} initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -90, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="absolute inset-x-3 top-12 z-40 flex items-start gap-3 rounded-2xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/5 backdrop-blur" role="status">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", app.note.tone === "scam" ? "bg-[#ff3b30] text-white" : app.note.tone === "safe" ? "bg-safe text-white" : "bg-lamp text-coal")}>
        {app.note.tone === "scam" ? <Prohibit size={22} weight="bold" /> : app.note.tone === "safe" ? <CheckCircle size={22} weight="fill" /> : <Bell size={22} weight="fill" />}</span>
      <span className="min-w-0"><span className="flex justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><span>CallCanary</span><span>now</span></span>
        <strong className="block text-base leading-tight">{app.note.title}</strong><span className="block truncate text-sm text-muted-foreground">{app.note.body}</span></span>
    </motion.div>}</AnimatePresence>
    {/* Overlays */}
    <AnimatePresence>{app.browser && <BlockedSite key="browser" finding={app.browser} onClose={() => app.setBrowser(null)} />}</AnimatePresence>
    <AnimatePresence>{app.call && <CallScreen key="call" app={app} />}</AnimatePresence>
    <AnimatePresence>{app.liveCall && <LiveCallScreen key="live" app={app} />}</AnimatePresence>
  </div>;
}

function Home({ app }: { app: DemoApp }) {
  const stats = [
    { label: "Scams stopped", value: app.scamsStopped, Icon: ShieldCheck },
    { label: "Numbers blocked", value: app.stats.numbers, Icon: PhoneX },
    { label: "Sites blocked", value: app.stats.sites, Icon: Globe },
    { label: "Emails to Scam", value: app.stats.emails, Icon: EnvelopeSimple },
  ];
  return <div className="grid gap-4">
    <div className="flex items-center gap-3 rounded-2xl border-2 bg-card p-4">
      <Mascot mood="alert" size="sm" />
      <div><p className="font-display text-2xl font-extrabold leading-tight">You&apos;re protected</p><p className="text-base text-muted-foreground">Watching your calls, texts, Gmail and websites.</p></div>
    </div>
    <div className="grid grid-cols-2 gap-3">{stats.map(({ label, value, Icon }) => <div key={label} className="rounded-2xl border-2 bg-card p-3">
      <Icon size={22} weight="fill" className="text-primary" aria-hidden="true" />
      <motion.p key={value} initial={{ scale: 1.4, color: "hsl(357 80% 39%)" }} animate={{ scale: 1, color: "hsl(154 25% 11%)" }} className="origin-left font-display text-4xl font-extrabold tabular-nums">{value}</motion.p>
      <p className="text-sm font-bold text-muted-foreground">{label}</p></div>)}</div>
    <div className="grid gap-2 rounded-2xl border-2 bg-card p-4">
      <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Protection</p>
      {[["AI call screening", "On"], ["Reported-number blocking", "On"], ["Gmail scam check", app.gmail ? "Connected" : "Not connected"], ["Safe browsing", "On"]].map(([label, state]) =>
        <p key={label} className="flex items-center justify-between text-base"><span>{label}</span><span className={cn("font-bold", state === "Not connected" ? "text-muted-foreground" : "text-safe")}>{state}</span></p>)}
    </div>
  </div>;
}

function Inbox({ app }: { app: DemoApp }) {
  return <div className="grid gap-3">
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      {(["email", "texts"] as const).map(v => <button key={v} onClick={() => app.setInboxView(v)} className={cn("rounded-lg py-2 text-base font-bold", app.inboxView === v ? "bg-card shadow" : "text-muted-foreground")}>{v === "email" ? "Gmail" : "Texts"}</button>)}
    </div>
    {app.inboxView === "texts" ? <Texts app={app} /> : !app.gmail ? <div className="grid justify-items-center gap-3 rounded-2xl border-2 bg-card p-6 text-center">
      <EnvelopeSimple size={44} weight="duotone" className="text-primary" />
      <p className="font-display text-2xl font-extrabold">Connect your Gmail</p>
      <p className="text-base text-muted-foreground">CallCanary checks every new email for phishing, fake senders and look-alike links.</p>
      <Button onClick={app.connectGmail}><LockSimple weight="bold" />Connect Gmail (demo)</Button>
    </div> : <>
      <div className="flex gap-2">{(["inbox", "scam"] as const).map(f => <button key={f} onClick={() => app.setFolder(f)}
        className={cn("rounded-full border-2 px-4 py-1.5 text-base font-bold", app.folder === f ? (f === "scam" ? "border-danger bg-danger text-white" : "border-primary bg-primary text-white") : "bg-card text-muted-foreground")}>
        {f === "inbox" ? "Inbox" : "Scam"} {app.mail.filter(m => m.folder === f).length}</button>)}</div>
      <ul className="grid gap-2"><AnimatePresence initial={false}>{app.mail.filter(m => m.folder === app.folder).map(item => <motion.li key={item.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }}>
        <button onClick={() => app.setOpenId(item.id)} className={cn("grid w-full gap-0.5 rounded-2xl border-2 bg-card p-3 text-left", item.status === "scam" && "border-danger/60")}>
          <span className="flex items-center justify-between gap-2"><strong className="truncate text-base">{item.from}</strong><span className="shrink-0 text-xs text-muted-foreground">{item.time}</span></span>
          <span className="truncate text-base font-bold">{item.subject}</span>
          <span className="truncate text-sm text-muted-foreground">{item.preview}</span>
          <span className={cn("mt-1 flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold", statusLook[item.status].className)}>
            {item.status === "scanning" && <Spinner size={12} className="animate-spin" />}{statusLook[item.status].label}</span>
        </button></motion.li>)}</AnimatePresence></ul>
      {app.mail.filter(m => m.folder === app.folder).length === 0 && <p className="text-center text-base text-muted-foreground">Nothing here.</p>}
    </>}
  </div>;
}

function EmailDetail({ item, app }: { item: MailItem; app: DemoApp }) {
  const r = item.result;
  const body = item.text.replace(/^(?:Subject|From):.*$/gim, "").replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1").replace(/<[^>]+>/g, "\n").replace(/\n{2,}/g, "\n").trim();
  return <div className="grid gap-3">
    <button onClick={() => app.setOpenId(null)} className="flex w-fit items-center gap-1 text-base font-bold text-primary"><ArrowLeft size={18} weight="bold" />Inbox</button>
    <div className="grid gap-1"><p className="font-display text-2xl font-extrabold leading-tight">{item.subject}</p>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{item.from} · {item.address}{r?.sender?.spoofed && <Badge variant="danger">Fake sender</Badge>}</p></div>
    {r && r.level !== "safe" && <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="alarm-rings grid gap-2 rounded-2xl p-4 text-white">
      <p className="flex items-center gap-2 font-display text-2xl font-extrabold"><XCircle size={28} weight="fill" />Phishing email</p>
      {r.typos.length > 0 && <p className="text-base"><strong>{r.typos.length} spelling {r.typos.length === 1 ? "mistake" : "mistakes"}:</strong> {r.typos.slice(0, 3).map((t, i) => <span key={i}><del className="opacity-80">{t.typo}</del> → <strong className="text-[#ffe08a]">{t.correction}</strong>{i < Math.min(3, r.typos.length) - 1 ? ", " : ""}</span>)}</p>}
      {r.links.filter(l => l.verdict !== "safe").slice(0, 1).map((l, i) => <p key={i} className="rounded-xl bg-black/20 p-2 text-base">Link says <strong>{l.shown_domain || l.display_text}</strong>, actually goes to <strong className="text-[#ffe08a]">{l.actual_domain}</strong></p>)}
      <p className="text-base">{r.recommended_action}</p>
    </motion.div>}
    {r && r.level === "safe" && <div className="flex items-center gap-2 rounded-2xl bg-safe-soft p-3 text-base font-bold text-safe"><CheckCircle size={24} weight="fill" />No warning signs. Links are safe.</div>}
    {!r && <div className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-base font-bold text-muted-foreground"><Spinner size={20} className="animate-spin" />CallCanary is checking this email…</div>}
    <div className="whitespace-pre-line rounded-2xl border-2 bg-card p-4 text-base leading-relaxed">{body}
      {item.link && <button onClick={() => app.openLink(item.link!.href)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0067b8] px-4 py-3 text-base font-bold text-white">{item.link.label}<CaretRight size={18} weight="bold" /></button>}
    </div>
  </div>;
}

function Texts({ app }: { app: DemoApp }) {
  if (app.text.status === "none") return <p className="p-6 text-center text-base text-muted-foreground">No new texts.</p>;
  const scam = app.text.status === "scam";
  return <div className="grid gap-2">
    <p className="text-center text-sm font-bold text-muted-foreground">{DEMO_TEXT.from} · {DEMO_TEXT.time}</p>
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("max-w-[85%] rounded-2xl rounded-bl-md p-3 text-base", scam ? "border-2 border-danger bg-danger-soft" : "bg-muted")}>
      {DEMO_TEXT.text.replace(/\S+\.ru\/\S+/, "")}<button onClick={() => app.openLink(DEMO_TEXT.link)} className="font-bold text-[#0067b8] underline">usps-track-secure.ru/pay</button>
    </motion.div>
    {app.text.status === "scanning" && <p className="flex items-center gap-2 text-base font-bold text-muted-foreground"><Spinner size={18} className="animate-spin" />CallCanary is checking this text…</p>}
    {scam && <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="alarm-rings grid gap-1 rounded-2xl p-4 text-white">
      <p className="flex items-center gap-2 font-display text-xl font-extrabold"><Warning size={24} weight="fill" />Scam text</p>
      <p className="text-base">{app.text.result?.links.find(l => l.verdict !== "safe")?.explanation || "Fake delivery fee with a look-alike link."}</p>
      <p className="text-base font-bold text-[#ffe08a]">Sender blocked. Don&apos;t tap the link.</p>
    </motion.div>}
  </div>;
}

function Calls({ app }: { app: DemoApp }) {
  return <div className="grid gap-3">
    <div className="flex items-center gap-3 rounded-2xl border-2 bg-card p-3"><PhoneIncoming size={28} weight="fill" className="text-primary" />
      <div><p className="text-base font-bold">AI call screening is on</p><p className="text-sm text-muted-foreground">Unknown callers talk to CallCanary first.</p></div></div>
    <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Recent calls</p>
    {app.calls.length === 0 ? <p className="text-base text-muted-foreground">No calls yet.</p> : <ul className="grid gap-2">{app.calls.map((c, i) => <motion.li key={`${c.number}-${i}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border-2 bg-card p-3">
      {c.outcome === "allowed" ? <CheckCircle size={28} weight="fill" className="shrink-0 text-safe" /> : <PhoneX size={28} weight="fill" className="shrink-0 text-danger" />}
      <span className="min-w-0 flex-1"><strong className="block text-base tabular-nums">{c.number}</strong><span className="block text-sm text-muted-foreground">{c.label}</span></span>
      <span className="text-xs text-muted-foreground">{c.at}</span></motion.li>)}</ul>}
  </div>;
}

function Web({ app }: { app: DemoApp }) {
  const [url, setUrl] = useState("");
  return <div className="grid gap-3">
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (url.trim()) app.openLink(url.trim()); }}>
      <label htmlFor="demo-url" className="sr-only">Website address</label>
      <input id="demo-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Type a website" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring" />
      <Button size="sm" type="submit" className="min-h-12">Go</Button>
    </form>
    <div className="flex flex-wrap gap-2">{DEMO_SITES.map(site => <button key={site} onClick={() => app.openLink(site)} className="rounded-full border-2 bg-card px-3 py-1 text-sm font-bold">{site}</button>)}</div>
    <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Recently checked</p>
    {app.siteChecks.length === 0 ? <p className="text-base text-muted-foreground">Safe browsing checks every link you open.</p> : <ul className="grid gap-2">{app.siteChecks.map(f => <li key={f.actual_url} className="flex items-center gap-3 rounded-2xl border-2 bg-card p-3">
      {f.verdict === "safe" ? <CheckCircle size={26} weight="fill" className="shrink-0 text-safe" /> : <Prohibit size={26} weight="bold" className="shrink-0 text-danger" />}
      <span className="min-w-0"><strong className="block break-all text-base">{f.actual_domain}</strong><span className="block text-sm text-muted-foreground">{f.verdict === "safe" ? "Allowed" : "Blocked"}</span></span></li>)}</ul>}
  </div>;
}

function Blocked({ app }: { app: DemoApp }) {
  const groups = [["number", "Numbers"], ["site", "Websites"], ["sender", "Email senders"]] as const;
  if (!app.blocked.length) return <p className="p-6 text-center text-base text-muted-foreground">Nothing blocked yet.</p>;
  return <div className="grid gap-4">{groups.map(([kind, label]) => { const items = app.blocked.filter(b => b.kind === kind); if (!items.length) return null;
    return <section key={kind} className="grid gap-2"><p className="text-sm font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{label} · {items.length}</p>
      <ul className="grid gap-2">{items.map(b => <motion.li key={b.value} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 rounded-2xl border-2 border-danger/40 bg-card p-3">
        <Prohibit size={24} weight="bold" className="mt-0.5 shrink-0 text-danger" />
        <span className="min-w-0 flex-1"><strong className="block break-all text-base">{b.value}</strong><span className="block text-sm text-muted-foreground">{b.reason}</span><span className="text-xs text-muted-foreground">{b.at}</span></span>
        <button onClick={() => app.unblock(b)} className="shrink-0 rounded-lg border-2 px-2 py-1 text-xs font-bold">Unblock</button></motion.li>)}</ul></section>; })}</div>;
}

/** Splits look-alike and real labels into same / different parts: "rn|icrosoft" vs "m|icrosoft". */
function diffParts(fake: string, real: string) {
  let start = 0; while (start < Math.min(fake.length, real.length) && fake[start] === real[start]) start++;
  let end = 0; while (end < Math.min(fake.length, real.length) - start && fake[fake.length - 1 - end] === real[real.length - 1 - end]) end++;
  return { fake: [fake.slice(0, start), fake.slice(start, fake.length - end), fake.slice(fake.length - end)], real: [real.slice(0, start), real.slice(start, real.length - end), real.slice(real.length - end)] };
}
function BlockedSite({ finding, onClose }: { finding: LinkFinding; onClose: () => void }) {
  const safe = finding.verdict === "safe";
  const brand = lookalikeBrand(finding.actual_domain);
  const info = brand ? brandInfo(brand) : null;
  const fakeLabel = finding.actual_domain.replace(/^www\./, "");
  // Compare whole addresses: "rn|icrosoft.com" vs "m|icrosoft.com", "usps|-track-secure.ru" vs "usps|.com".
  const parts = info ? diffParts(fakeLabel, info.domain) : null;
  return <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }} className="absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col bg-background">
    <div className="flex items-center gap-2 border-b-2 bg-card px-3 py-2"><LockSimple size={16} weight="bold" className="text-muted-foreground" /><span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-1.5 text-sm">{finding.actual_url}</span></div>
    {safe ? <div className="grid flex-1 content-center justify-items-center gap-3 p-6 text-center">
      <CheckCircle size={64} weight="fill" className="text-safe" /><p className="font-display text-3xl font-extrabold">Safe to open</p>
      <p className="text-base text-muted-foreground">{finding.actual_domain} passed CallCanary&apos;s checks.</p><Button onClick={onClose}>Close</Button>
    </div> : <div className="alarm-rings flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6 text-center text-white">
      <motion.div initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}><Prohibit size={72} weight="bold" /></motion.div>
      <p className="font-display text-4xl font-extrabold leading-none">Website blocked</p>
      <p className="break-all text-xl font-bold text-[#ffe08a]">{fakeLabel}</p>
      {info && parts && <div className="grid w-full gap-2 rounded-2xl bg-black/25 p-4 text-left">
        <p className="text-base">It looks like <strong>{info.name}</strong>, but it isn&apos;t:</p>
        <p className="font-mono text-2xl"><span>{parts.fake[0]}</span><mark className="rounded bg-[#ffe08a] px-0.5 text-coal">{parts.fake[1]}</mark><span>{parts.fake[2]}</span> <span className="text-base">fake</span></p>
        <p className="font-mono text-2xl"><span>{parts.real[0]}</span><mark className="rounded bg-[#a8f0c0] px-0.5 text-coal">{parts.real[1]}</mark><span>{parts.real[2]}</span> <span className="text-base">real</span></p>
      </div>}
      <ul className="grid w-full gap-1 text-left text-base">{finding.flags.filter(f => f.severity !== "info").map(f => <li key={f.code} className="flex gap-2"><Warning size={20} weight="fill" className="mt-0.5 shrink-0" />{f.message}</li>)}</ul>
      <Button variant="outline" size="lg" className="mt-auto w-full border-white bg-white text-destructive" onClick={onClose}><ArrowLeft weight="bold" />Back to safety</Button>
    </div>}
  </motion.div>;
}

function CallScreen({ app }: { app: DemoApp }) {
  const call = app.call!;
  const glow = call.phase === "prevented" || (call.phase === "verdict" || call.phase === "goodbye") && call.result?.verdict === "scam" ? "rgba(255,59,48,0.5)"
    : call.phase === "listening" ? "rgba(52,199,89,0.38)" : call.phase === "verdict" && call.result?.verdict === "safe" ? "rgba(52,199,89,0.42)" : "rgba(244,207,71,0.38)";
  const mood = call.phase === "greeting" || call.phase === "goodbye" ? "speaking" : call.phase === "listening" ? "alert" : call.phase === "checking" || call.phase === "precheck" ? "concerned"
    : call.phase === "prevented" || call.result?.verdict === "scam" ? "warning" : "alert";
  const title = { incoming: "Incoming call", precheck: "Checking the number…", prevented: "Blocked before it rang", greeting: "CallCanary answered", listening: "Listening to the caller…",
    checking: "Checking what they said…", verdict: call.result?.headline || "", goodbye: "Saying goodbye…" }[call.phase];
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-glow="" style={{ "--glow": glow } as React.CSSProperties}
    className="mine absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col items-center px-5 pb-8 pt-6 text-center text-white">
    <p className="text-sm font-bold uppercase tracking-[0.12em] text-call-muted">{call.phase === "incoming" ? "Unknown caller" : "CallCanary call screen"}</p>
    <p className="font-display text-3xl font-extrabold tabular-nums">{call.result?.stated_name ? `“${call.result.stated_name}”` : call.number}</p>
    {call.result?.stated_name && <p className="text-base tabular-nums text-white/75">{call.number}</p>}
    <AnimatePresence mode="wait"><motion.p key={title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={cn("mt-1 text-xl font-extrabold", (call.phase === "prevented" || call.result?.verdict === "scam") ? "text-[#ffb4ae]" : "text-white")}>{title}</motion.p></AnimatePresence>
    <div className="relative my-5 grid size-36 place-items-center">
      {(call.phase === "incoming" || call.phase === "listening" || call.phase === "greeting") && <motion.span className="absolute inset-0 rounded-full border-4 border-white/40" animate={{ scale: [1, 1.25], opacity: [0.7, 0] }} transition={{ duration: 1.3, repeat: Infinity }} />}
      <Mascot mood={mood} size="sm" className="!size-32" />
    </div>
    <div className="min-h-0 w-full flex-1 overflow-y-auto">
      {call.phase === "prevented" && call.check?.status === "reported" && <p className="text-lg">Reported to the FTC <strong className="text-[#ffe08a]">{call.check.reports} times</strong>, most recently {call.check.last_reported} (“{call.check.topic}”). Your phone never rang.</p>}
      {(call.phase === "greeting" || call.phase === "listening") && call.caption && <p className="rounded-2xl bg-black/25 p-3 text-left text-base"><strong className="text-lamp">{call.phase === "greeting" ? "CallCanary: " : "Caller: "}</strong>{call.caption}</p>}
      {call.phase === "checking" && <ul className="grid gap-1.5 text-left">{call.layers.map(layer => <LayerRow key={layer.id} layer={layer} decided={false} />)}</ul>}
      {/* Verdict: the deciding check first, then only the checks that raised a warning, so it all fits on screen. */}
      {call.phase === "verdict" && <ul className="grid gap-1.5 text-left">{[...call.layers].filter(l => l.id === call.result?.decided_by || l.status === "flagged")
        .sort((a, b) => Number(b.id === call.result?.decided_by) - Number(a.id === call.result?.decided_by))
        .map(layer => <LayerRow key={layer.id} layer={layer} decided={call.result?.decided_by === layer.id} />)}</ul>}
      {call.phase === "goodbye" && <p className="text-lg">“Thank you. The person you&apos;re calling isn&apos;t available right now. Goodbye.”</p>}
    </div>
    <div className="mt-4 flex gap-10">
      {call.phase === "incoming" ? <><span className="grid justify-items-center gap-1 text-sm font-bold"><span className="grid size-16 place-items-center rounded-full bg-[#ff3b30]"><PhoneDisconnect size={30} weight="fill" /></span>Decline</span>
        <span className="grid justify-items-center gap-1 text-sm font-bold"><span className="grid size-16 place-items-center rounded-full bg-lamp text-coal"><ShieldCheck size={30} weight="fill" /></span>Screen</span></>
        : <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{call.phase === "greeting" || call.phase === "goodbye" ? <><SpeakerHigh size={18} weight="fill" />CallCanary is speaking</> : call.phase === "prevented" ? <><Prohibit size={18} weight="bold" />Number blocked</> : <><ClockCounterClockwise size={18} weight="bold" />Your phone stays quiet</>}</span>}
    </div>
  </motion.div>;
}
function LayerRow({ layer, decided }: { layer: ScreenLayer; decided: boolean }) {
  const icon = layer.status === "flagged" ? <XCircle size={20} weight="fill" className="text-[#ff6b61]" /> : layer.status === "clear" ? <CheckCircle size={20} weight="fill" className="text-[#5be08a]" />
    : layer.status === "pending" ? <Spinner size={20} className="animate-spin text-lamp" /> : <ChatCircleText size={20} weight="fill" className="text-white/50" />;
  return <motion.li layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className={cn("flex items-start gap-2 rounded-xl bg-black/25 p-2 text-sm", decided && "ring-2 ring-lamp")}>
    <span className="mt-0.5 shrink-0">{icon}</span><span className="min-w-0"><strong className="block">{layer.label}{decided && <span className="ml-2 rounded-full bg-lamp px-2 text-[11px] text-coal">DECIDED</span>}</strong>
      <span className="line-clamp-2 text-white/75">{layer.detail}</span></span></motion.li>;
}
