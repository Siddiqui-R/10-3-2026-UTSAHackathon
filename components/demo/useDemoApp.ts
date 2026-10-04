"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EmailResult } from "@/lib/emailAnalysis";
import { analyzeLink, type LinkFinding } from "@/lib/linkCheck";
import type { NumberCheck } from "@/lib/reportedNumbers";
import type { ScreenLayer, ScreenResult } from "@/lib/screening";
import { SCREEN_GOODBYE, SCREEN_GREETING } from "@/lib/screening";
import { runScreen } from "@/lib/screenClient";
import { fetchVoice, playAudio } from "@/lib/audioPlayback";
import { DEMO_CONTACTS } from "@/lib/screenDemos";
import { DEMO_EMAILS, DEMO_LIVE_CALL, DEMO_LIVE_EMAIL, DEMO_ROBOCALL, DEMO_SCREEN_CALL, DEMO_TEXT, TOUR, type DemoEmail } from "@/lib/demoScenario";
import type { Analysis } from "@/lib/analysis";
import { scoreSignals, SIGNAL_THRESHOLD, type ScamSignal } from "@/lib/scamSignals";
import { analyzeTranscript } from "@/lib/useListening";
import { warningText } from "@/lib/warningText";

export type Tab = "home" | "inbox" | "calls" | "web" | "blocked";
export type MailStatus = "new" | "scanning" | "scam" | "careful" | "safe";
export type MailItem = DemoEmail & { status: MailStatus; result?: EmailResult; folder: "inbox" | "scam" };
export type BlockedItem = { kind: "number" | "site" | "sender"; value: string; reason: string; at: string };
export type CallLog = { number: string; label: string; outcome: "blocked" | "screened" | "allowed"; at: string };
export type CallState = { phase: "incoming" | "precheck" | "prevented" | "greeting" | "listening" | "checking" | "verdict" | "goodbye"; number: string;
  caption: string; layers: ScreenLayer[]; result?: ScreenResult; check?: NumberCheck } | null;
export type TextState = { status: "none" | "scanning" | "scam" | "safe"; result?: EmailResult };
// A call the person answered themselves; CallCanary listens in the background.
export type LiveCall = { phase: "ringing" | "answering" | "active" | "checking" | "warning" | "blocking" | "blocked"; number: string; caption: string;
  score: number; signals: ScamSignal[]; seconds: number; verdict?: Analysis; speaking?: boolean } | null;
export type Note = { id: number; title: string; body: string; tone: "scam" | "safe" | "info" } | null;

const now = () => new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const verdictOf = (result: EmailResult): MailStatus => result.level === "phishing" ? "scam" : result.level === "suspicious" ? "careful" : "safe";

export function useDemoApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [inboxView, setInboxView] = useState<"email" | "texts">("email");
  const [folder, setFolder] = useState<"inbox" | "scam">("inbox");
  const [gmail, setGmail] = useState(false);
  const [mail, setMail] = useState<MailItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState<TextState>({ status: "none" });
  const [browser, setBrowser] = useState<LinkFinding | null>(null);
  const [siteChecks, setSiteChecks] = useState<LinkFinding[]>([]);
  const [blocked, setBlocked] = useState<BlockedItem[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [call, setCall] = useState<CallState>(null);
  const [liveCall, setLiveCall] = useState<LiveCall>(null);
  const blockTap = useRef<(() => void) | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);
  const run = useRef(0);
  const controllers = useRef<AbortController[]>([]);
  const players = useRef<HTMLAudioElement[]>([]);

  // Every scene runs under a token; starting another scene or resetting cancels it (requests, audio, waits).
  const cancel = useCallback(() => {
    run.current++;
    controllers.current.forEach(c => c.abort()); controllers.current = [];
    players.current.forEach(p => p.pause()); players.current = [];
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);
  useEffect(() => () => cancel(), [cancel]);
  const begin = () => { cancel(); const id = run.current; return { live: () => run.current === id, wait: (ms: number) => new Promise<boolean>(r => setTimeout(() => r(run.current === id), ms)) }; };
  const controller = () => { const c = new AbortController(); controllers.current.push(c); return c; };
  const notify = (title: string, body: string, tone: NonNullable<Note>["tone"]) => {
    const id = Date.now(); setNote({ id, title, body, tone });
    setTimeout(() => setNote(current => current?.id === id ? null : current), 4200);
  };
  const block = (item: Omit<BlockedItem, "at">) => setBlocked(list => list.some(b => b.kind === item.kind && b.value === item.value) ? list : [{ ...item, at: now() }, ...list]);

  async function analyze(textToCheck: string, signal: AbortSignal): Promise<EmailResult> {
    const response = await fetch("/api/analyze-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailText: textToCheck }), signal });
    if (!response.ok) throw new Error("check failed");
    return response.json();
  }
  // Scan one email with the real analyzer; phishing slides into Scam and its sender is blocked.
  async function scanEmail(item: DemoEmail, live: () => boolean, wait: (ms: number) => Promise<boolean>) {
    setMail(list => list.map(m => m.id === item.id ? { ...m, status: "scanning" } : m));
    let result: EmailResult;
    try { result = await analyze(item.text, controller().signal); } catch { if (live()) setMail(list => list.map(m => m.id === item.id ? { ...m, status: "new" } : m)); return; }
    if (!live()) return;
    const status = verdictOf(result);
    setMail(list => list.map(m => m.id === item.id ? { ...m, status, result } : m));
    if (status === "scam") {
      if (!(await wait(900))) return;
      setMail(list => list.map(m => m.id === item.id ? { ...m, folder: "scam" } : m));
      block({ kind: "sender", value: item.address, reason: result.sender?.spoofed ? `Pretends to be ${result.sender.claimed_brand || item.from}` : "Phishing email" });
      notify("Phishing moved to Scam", `“${item.subject}” from ${item.address}`, "scam");
    }
  }

  const sceneHome = async () => { const { wait } = begin(); setScene("home"); setCall(null); setLiveCall(null); setBrowser(null); setOpenId(null); setTab("home"); await wait(3500); };
  const sceneGmail = async () => {
    const { live, wait } = begin(); setScene("gmail"); setCall(null); setLiveCall(null); setBrowser(null); setOpenId(null);
    setTab("inbox"); setInboxView("email"); setFolder("inbox");
    if (!gmail) { if (!(await wait(1600))) return; setGmail(true); setMail(DEMO_EMAILS.map(e => ({ ...e, status: "new", folder: "inbox" }))); notify("Gmail connected", "CallCanary is checking your inbox.", "info"); }
    if (!(await wait(800))) return;
    for (const item of DEMO_EMAILS) { await scanEmail(item, live, wait); if (!live()) return; }
    if (!(await wait(1200))) return;
    setFolder("scam"); if (!(await wait(1400))) return;
    setOpenId("paypal"); await wait(6500);
  };
  const sceneWeb = async () => {
    const { live, wait } = begin(); setScene("web"); setCall(null); setLiveCall(null); setBrowser(null);
    setTab("inbox"); setInboxView("email"); setFolder("inbox"); setOpenId(null); setGmail(true);
    setMail(list => list.length ? list : DEMO_EMAILS.map(e => ({ ...e, status: "new", folder: "inbox" })));
    setMail(list => list.some(m => m.id === DEMO_LIVE_EMAIL.id) ? list.map(m => m.id === DEMO_LIVE_EMAIL.id ? { ...m, folder: "inbox", status: "new" } : m) : [{ ...DEMO_LIVE_EMAIL, status: "new", folder: "inbox" }, ...list]);
    notify("New email", `${DEMO_LIVE_EMAIL.from}: ${DEMO_LIVE_EMAIL.subject}`, "info");
    if (!(await wait(1800))) return;
    setOpenId(DEMO_LIVE_EMAIL.id);
    if (!(await wait(2600))) return;
    openLink(DEMO_LIVE_EMAIL.link!.href);
    if (!(await wait(7000))) return;
    setBrowser(null);
    await scanEmail(DEMO_LIVE_EMAIL, live, wait);
    if (!(await wait(1500))) return;
    setOpenId(null); setTab("web"); await wait(3500);
  };
  const sceneText = async () => {
    const { live, wait } = begin(); setScene("text"); setCall(null); setLiveCall(null); setBrowser(null); setOpenId(null);
    setTab("inbox"); setInboxView("texts"); setText({ status: "none" });
    if (!(await wait(900))) return;
    notify("New text message", `${DEMO_TEXT.from}: ${DEMO_TEXT.text.slice(0, 60)}…`, "info");
    setText({ status: "scanning" });
    let result: EmailResult;
    try { result = await analyze(DEMO_TEXT.text, controller().signal); } catch { if (live()) setText({ status: "none" }); return; }
    if (!live()) return;
    const scam = result.level !== "safe";
    setText({ status: scam ? "scam" : "safe", result });
    if (scam) { block({ kind: "number", value: DEMO_TEXT.from, reason: "Scam text with a fake delivery link" }); notify("Scam text flagged", "Fake USPS fee with a look-alike link. Sender blocked.", "scam"); }
    if (!(await wait(3000))) return;
    openLink(DEMO_TEXT.link); await wait(5500); if (live()) setBrowser(null);
  };
  const sceneRobocall = async () => {
    const { live, wait } = begin(); setScene("robocall"); setBrowser(null); setOpenId(null); setTab("calls");
    setCall({ phase: "incoming", number: DEMO_ROBOCALL.number, caption: "", layers: [] });
    if (!(await wait(1200))) return;
    setCall(c => c && { ...c, phase: "precheck" });
    let check: NumberCheck;
    try { check = await (await fetch(`/api/check-number?phone=${encodeURIComponent(DEMO_ROBOCALL.number)}`, { signal: controller().signal })).json(); }
    catch { if (live()) setCall(null); return; }
    if (!live()) return;
    if (check.status === "reported") {
      setCall(c => c && { ...c, phase: "prevented", check });
      block({ kind: "number", value: DEMO_ROBOCALL.number, reason: `Reported to the FTC ${check.reports} times (“${check.topic}”)` });
      setCalls(list => [{ number: DEMO_ROBOCALL.number, label: `Blocked before ringing · ${check.status === "reported" ? check.reports : 0} FTC reports`, outcome: "blocked", at: now() }, ...list]);
      if (!(await wait(4200))) return;
      setCall(null); notify("Robocall blocked", `${DEMO_ROBOCALL.number} never rang. Reported to the FTC ${check.reports} times.`, "scam");
    } else setCall(null);
    await wait(2500);
  };
  const sceneScreener = async () => {
    const { live, wait } = begin(); setScene("screener"); setBrowser(null); setOpenId(null); setTab("calls");
    const number = DEMO_SCREEN_CALL.number;
    setCall({ phase: "incoming", number, caption: "", layers: [] });
    if (!(await wait(2200))) return;
    setCall(c => c && { ...c, phase: "greeting", caption: SCREEN_GREETING });
    let greeting: string | undefined;
    try { greeting = await fetchVoice("greeting"); } catch { greeting = undefined; }
    if (!live()) return;
    await playAudio(greeting, SCREEN_GREETING, p => { players.current.push(p); });
    if (greeting) URL.revokeObjectURL(greeting);
    if (!live()) return;
    setCall(c => c && { ...c, phase: "listening", caption: "" });
    // Show the caller's words as they speak.
    const words = DEMO_SCREEN_CALL.caption.split(" ");
    let shown = 0;
    const typing = setInterval(() => { shown = Math.min(words.length, shown + 1); setCall(c => c && c.phase === "listening" ? { ...c, caption: words.slice(0, shown).join(" ") } : c); }, 320);
    await playAudio(DEMO_SCREEN_CALL.audio, DEMO_SCREEN_CALL.caption, p => { players.current.push(p); });
    clearInterval(typing);
    if (!live()) return;
    setCall(c => c && { ...c, phase: "checking", caption: DEMO_SCREEN_CALL.caption });
    let result: ScreenResult;
    try {
      const audio = await (await fetch(DEMO_SCREEN_CALL.audio, { signal: controller().signal })).blob();
      const form = new FormData(); form.append("audio", new Blob([audio], { type: "audio/mpeg" }), "reply.mp3");
      form.append("phone", number); form.append("contacts", JSON.stringify(DEMO_CONTACTS));
      result = await runScreen(form, progress => { if (live()) setCall(c => c && { ...c, layers: progress.layers }); });
    } catch { if (live()) setCall(null); return; }
    if (!live()) return;
    setCall(c => c && { ...c, phase: "verdict", result, layers: result.layers });
    if (!(await wait(3800))) return;
    if (result.verdict !== "safe") {
      setCall(c => c && { ...c, phase: "goodbye" });
      let bye: string | undefined;
      try { bye = await fetchVoice("goodbye"); } catch { bye = undefined; }
      if (!live()) return;
      await playAudio(bye, SCREEN_GOODBYE, p => { players.current.push(p); });
      if (bye) URL.revokeObjectURL(bye);
      if (!live()) return;
      block({ kind: "number", value: number, reason: result.headline + (result.stated_name ? ` (“${result.stated_name}”)` : "") });
      notify("Scam call blocked", `${result.stated_name ? `“${result.stated_name}” · ` : ""}${number}`, "scam");
    }
    setCalls(list => [{ number, label: `${result.stated_name ? `“${result.stated_name}” · ` : ""}${result.headline}`, outcome: result.verdict === "safe" ? "allowed" : "screened", at: now() }, ...list]);
    setCall(null); await wait(2500);
  };
  const sceneLive = async () => {
    const { live, wait } = begin(); setScene("live"); setCall(null); setBrowser(null); setOpenId(null); setTab("calls");
    const number = DEMO_LIVE_CALL.number;
    setLiveCall({ phase: "ringing", number, caption: "", score: 0, signals: [], seconds: 0 });
    if (!(await wait(2600))) return;
    setLiveCall(c => c && { ...c, phase: "answering" });
    if (!(await wait(700))) return;
    setLiveCall(c => c && { ...c, phase: "active" });
    // The caller speaks. Captions follow the audio's real position; the phrase score updates as words arrive.
    const words = DEMO_LIVE_CALL.text.split(" ");
    const audio = new Audio(DEMO_LIVE_CALL.audio); players.current.push(audio);
    let playing = true; let finished = false;
    audio.onended = () => { finished = true; }; audio.onerror = () => { playing = false; };
    audio.play().catch(() => { playing = false; });
    const started = Date.now();
    const progress = () => playing && audio.duration ? audio.currentTime / audio.duration : (Date.now() - started) / 26_000;
    // Held in an object because the timer callback assigns it.
    const pending: { check: Promise<Analysis | null> | null } = { check: null };
    const tick = setInterval(() => {
      if (!live()) return;
      const caption = words.slice(0, Math.min(words.length, Math.ceil(words.length * progress() * 1.04))).join(" ");
      const scored = scoreSignals(caption);
      setLiveCall(c => c && (c.phase === "active" || c.phase === "checking") ? { ...c, caption, score: scored.score, signals: scored.signals, seconds: Math.floor((Date.now() - started) / 1000) } : c);
      // Phrases only start the check; the AI decides whether it's a scam.
      if (!pending.check && scored.score >= SIGNAL_THRESHOLD) {
        setLiveCall(c => c && { ...c, phase: "checking" });
        pending.check = analyzeTranscript(caption, controller().signal).catch(() => null);
      }
      if (!playing && progress() >= 1) finished = true;
    }, 250);
    let verdict: Analysis | null = null;
    for (;;) {
      if (!(await wait(250))) { clearInterval(tick); return; }
      if (pending.check) { verdict = await pending.check; break; }
      if (finished) break;
    }
    if (!live()) { clearInterval(tick); return; }
    if (!verdict || verdict.level !== "scam") {
      // Not confirmed as a scam: the call simply continues to its end.
      while (!finished) { if (!(await wait(300))) { clearInterval(tick); return; } }
      clearInterval(tick); setLiveCall(null);
      setCalls(list => [{ number, label: verdict ? "Answered · no scam found" : "Answered", outcome: "allowed", at: now() }, ...list]);
      return;
    }
    // Scam confirmed: let the sentence land, then cut the caller and warn.
    if (!(await wait(900))) { clearInterval(tick); return; }
    clearInterval(tick); audio.pause();
    setLiveCall(c => c && { ...c, phase: "warning", verdict: verdict!, speaking: true });
    let url: string | undefined;
    try {
      const response = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "scam", reasons: verdict.reasons.slice(0, 2) }), signal: controller().signal });
      if (response.ok) url = URL.createObjectURL(await response.blob());
    } catch { url = undefined; }
    if (!live()) return;
    await playAudio(url, warningText(verdict.reasons.slice(0, 2), "scam"), p => { players.current.push(p); });
    if (url) URL.revokeObjectURL(url);
    if (!live()) return;
    setLiveCall(c => c && { ...c, speaking: false });
    // "Hang up & block": the person taps it, or the tour taps it after a moment.
    await Promise.race([new Promise<void>(resolve => { blockTap.current = resolve; }), wait(2600)]);
    blockTap.current = null;
    if (!live()) return;
    setLiveCall(c => c && { ...c, phase: "blocking" });
    if (!(await wait(900))) return;
    setLiveCall(c => c && { ...c, phase: "blocked" });
    block({ kind: "number", value: number, reason: verdict.reasons[0] || "Scam call" });
    setCalls(list => [{ number, label: "Scam detected during the call · blocked", outcome: "blocked", at: now() }, ...list]);
    if (!(await wait(3000))) return;
    setLiveCall(null); notify("Call ended and number blocked", `${number} can't call you again.`, "scam");
    await wait(2200);
  };
  /** The "Hang up & block" button on the scam warning. */
  function blockLiveCall() { blockTap.current?.(); }
  const sceneBlocked = async () => { const { wait } = begin(); setScene("blocked"); setCall(null); setLiveCall(null); setBrowser(null); setOpenId(null); setTab("blocked"); if (!(await wait(4500))) return; setTab("home"); await wait(3500); };

  const scenes: Record<string, () => Promise<void>> = { home: sceneHome, gmail: sceneGmail, web: sceneWeb, text: sceneText, robocall: sceneRobocall, live: sceneLive, screener: sceneScreener, blocked: sceneBlocked };
  async function playScene(id: string) { setTouring(false); await scenes[id](); }
  async function playTour() {
    cancel(); setTouring(true);
    const token = run.current;
    for (const step of TOUR) {
      await scenes[step.id]();
      // A scene that was interrupted ends the tour.
      if (run.current !== token + TOUR.indexOf(step) + 1) { setTouring(false); return; }
    }
    setTouring(false); setScene(null);
  }
  function stop() { cancel(); setTouring(false); setScene(null); setCall(null); setLiveCall(null); }
  function reset() {
    stop(); setTab("home"); setInboxView("email"); setFolder("inbox"); setGmail(false); setMail([]); setOpenId(null); setText({ status: "none" });
    setBrowser(null); setSiteChecks([]); setBlocked([]); setCalls([]); setNote(null);
  }
  /** Open a link the way the phone would: the real link checker decides whether the site is blocked. */
  function openLink(href: string) {
    const finding = analyzeLink({ href, display_text: href });
    setBrowser(finding);
    setSiteChecks(list => [finding, ...list.filter(f => f.actual_url !== finding.actual_url)].slice(0, 8));
    if (finding.verdict !== "safe") {
      block({ kind: "site", value: finding.actual_domain || href, reason: finding.flags.find(f => f.severity !== "info")?.message || "Suspicious website" });
      notify("Website blocked", `${finding.actual_domain} was stopped before it opened.`, "scam");
    }
  }
  function connectGmail() {
    const { live, wait } = begin();
    setGmail(true); setMail(DEMO_EMAILS.map(e => ({ ...e, status: "new", folder: "inbox" })));
    void (async () => { for (const item of DEMO_EMAILS) { await scanEmail(item, live, wait); if (!live()) return; } })();
  }
  function unblock(item: BlockedItem) { setBlocked(list => list.filter(b => !(b.kind === item.kind && b.value === item.value))); }

  const stats = {
    numbers: blocked.filter(b => b.kind === "number").length,
    sites: blocked.filter(b => b.kind === "site").length,
    emails: mail.filter(m => m.folder === "scam").length,
  };
  return {
    tab, setTab, inboxView, setInboxView, folder, setFolder, gmail, connectGmail, mail, openId, setOpenId, text, browser, setBrowser, siteChecks,
    blocked, unblock, calls, call, liveCall, blockLiveCall, note, scene, touring, stats, openLink, playScene, playTour, stop, reset,
    scamsStopped: stats.numbers + stats.sites + stats.emails,
  };
}
export type DemoApp = ReturnType<typeof useDemoApp>;
