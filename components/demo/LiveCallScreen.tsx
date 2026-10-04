"use client";
import { motion } from "motion/react";
import { DotsNine, Microphone, PhoneDisconnect, PhoneIncoming, PhoneX, Plus, Prohibit, ShieldCheck, SpeakerHigh, Spinner, UserCircle, VideoCamera, Warning } from "@phosphor-icons/react";
import Mascot from "@/components/Mascot";
import { cn } from "@/lib/utils";
import type { DemoApp } from "./useDemoApp";

const callButtons = [
  { label: "mute", Icon: Microphone }, { label: "keypad", Icon: DotsNine }, { label: "speaker", Icon: SpeakerHigh },
  { label: "add call", Icon: Plus }, { label: "FaceTime", Icon: VideoCamera }, { label: "contacts", Icon: UserCircle },
];
/** A call the person answered: the phone's own call screen, with CallCanary listening on top. */
export default function LiveCallScreen({ app }: { app: DemoApp }) {
  const c = app.liveCall!;
  const clock = `${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, "0")}`;
  const inCall = c.phase === "active" || c.phase === "checking";

  if (c.phase === "warning" || c.phase === "blocking") return <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
    className="alarm-rings absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col items-center px-5 pb-6 pt-4 text-center text-white">
    <Mascot mood={c.speaking ? "speaking" : "warning"} size="sm" className="!size-32" />
    <p className="mt-1 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em]">CallCanary alert</p>
    <motion.p initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}
      className="mt-2 font-display text-4xl font-extrabold leading-[0.95]">SCAM CALL<span className="block text-2xl text-[#ffe08a]">HANG UP NOW</span></motion.p>
    <p className="mt-1 text-sm tabular-nums text-white/80">{c.number} · {clock}</p>
    <ul className="mt-3 grid w-full gap-2 text-left">{(c.verdict?.reasons || []).slice(0, 2).map((reason, i) => <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + 0.12 * i }}
      className="flex gap-2 rounded-xl bg-black/25 p-2.5 text-[15px] leading-snug"><Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-[#ffe08a]" />{reason}</motion.li>)}</ul>
    <p className="mt-3 flex items-center gap-2 text-sm font-bold">{c.speaking ? <><SpeakerHigh size={18} weight="fill" />CallCanary is explaining…</> : "Don't read them any code."}</p>
    <motion.button onClick={app.blockLiveCall} disabled={c.phase === "blocking"} animate={c.phase === "blocking" ? { scale: 0.95 } : c.speaking ? { scale: 1 } : { scale: [1, 1.04, 1] }}
      transition={c.phase === "blocking" ? { duration: 0.1 } : { duration: 1.1, repeat: c.speaking ? 0 : Infinity }}
      className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-display text-xl font-extrabold text-[#b3141b] shadow-xl">
      {c.phase === "blocking" ? <><Spinner size={22} className="animate-spin" />Hanging up &amp; blocking…</> : <><PhoneX size={24} weight="fill" />Hang up &amp; block</>}
    </motion.button>
  </motion.div>;

  if (c.phase === "blocked") return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="mine absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
    <motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 280, damping: 14 }}
      className="grid size-24 place-items-center rounded-full bg-[#ff3b30]"><Prohibit size={56} weight="bold" /></motion.div>
    <p className="font-display text-3xl font-extrabold">Call ended</p>
    <p className="text-xl font-bold tabular-nums text-[#ffe08a]">{c.number} is blocked</p>
    <p className="text-base text-white/80">This number can&apos;t call you again. CallCanary added it to your blocked list.</p>
  </motion.div>;

  // Ringing and in-call: the phone's own call screen.
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col items-center bg-[radial-gradient(120%_80%_at_50%_0%,#3a3a3c_0%,#1c1c1e_55%,#000_100%)] px-5 pb-7 pt-6 text-center text-white">
    <UserCircle size={inCall ? 52 : 84} weight="fill" className="text-white/40" />
    <p className={cn("font-bold", inCall ? "text-2xl" : "mt-2 text-3xl")}>Unknown</p>
    <p className="text-base tabular-nums text-white/70">{c.number} · mobile</p>
    <p className="text-sm tabular-nums text-white/60">{inCall ? clock : "incoming call…"}</p>
    {inCall && <>
      {/* CallCanary, running in the background during the call. */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 grid w-full gap-2 rounded-2xl bg-white/10 p-3 text-left ring-1 ring-white/15 backdrop-blur">
        <p className="flex items-center gap-2 text-sm font-extrabold">
          <span className="grid size-6 place-items-center rounded-md bg-lamp text-coal"><ShieldCheck size={16} weight="fill" /></span>
          {c.phase === "checking" ? <>CallCanary · checking with AI<Spinner size={16} className="ml-auto animate-spin text-lamp" /></> : <>CallCanary · listening
            <span className="ml-auto flex h-4 items-end gap-0.5" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <motion.span key={i} className="w-1 rounded-full bg-[#34c759]"
              animate={{ height: ["30%", "100%", "45%"] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }} />)}</span></>}
        </p>
        <p className="line-clamp-3 min-h-[3.75rem] text-[15px] leading-snug text-white/90">{c.caption ? `“…${c.caption.slice(-150)}”` : "Waiting for the caller to speak…"}</p>
        <div className="h-2 overflow-hidden rounded-full bg-white/15"><motion.div className={cn("h-full rounded-full", c.score >= 35 ? "bg-[#ff3b30]" : c.score > 0 ? "bg-[#ffcc00]" : "bg-[#34c759]")} animate={{ width: `${Math.max(4, c.score)}%` }} /></div>
        <div className="flex min-h-6 flex-wrap gap-1">{c.signals.map(signal => <motion.span key={signal.id} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-full bg-[#ff3b30]/85 px-2 py-0.5 text-[11px] font-bold">{signal.label} +{signal.weight}</motion.span>)}</div>
      </motion.div>
      <div className="mt-auto grid w-full grid-cols-3 gap-y-4 pb-5">{callButtons.map(({ label, Icon }) => <span key={label} className="grid justify-items-center gap-1 text-xs text-white/80">
        <span className={cn("grid size-14 place-items-center rounded-full", label === "speaker" ? "bg-white text-black" : "bg-white/15")}><Icon size={26} weight="fill" /></span>{label}</span>)}</div>
      <span className="grid size-16 place-items-center rounded-full bg-[#ff3b30]"><PhoneDisconnect size={30} weight="fill" /></span>
    </>}
    {!inCall && <div className="mt-auto flex w-full justify-around">
      <span className="grid justify-items-center gap-1 text-sm"><span className="grid size-[72px] place-items-center rounded-full bg-[#ff3b30]"><PhoneDisconnect size={34} weight="fill" /></span>Decline</span>
      <span className="grid justify-items-center gap-1 text-sm"><motion.span animate={c.phase === "answering" ? { scale: 0.85 } : { scale: [1, 1.1, 1] }}
        transition={c.phase === "answering" ? { duration: 0.15 } : { duration: 1, repeat: Infinity }}
        className="grid size-[72px] place-items-center rounded-full bg-[#34c759]"><PhoneIncoming size={34} weight="fill" /></motion.span>Accept</span>
    </div>}
  </motion.div>;
}
