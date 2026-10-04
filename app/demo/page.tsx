"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, ArrowLeft, Eye, EyeSlash, Play, Stop, VideoCamera } from "@phosphor-icons/react";
import PhoneApp from "@/components/demo/PhoneApp";
import { useDemoApp } from "@/components/demo/useDemoApp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TOUR } from "@/lib/demoScenario";
import { cn } from "@/lib/utils";

// A recordable product demo: a phone running CallCanary. The checks are real (email analyzer, link checker,
// FTC list, AI call screener); Gmail access and blocking are simulated and the phone says DEMO.
export default function ProductDemo() {
  const app = useDemoApp();
  const [controls, setControls] = useState(true);
  const [captions, setCaptions] = useState(true);
  // Keyboard shortcuts for recording: H hides the controls, C toggles captions.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, textarea")) return;
      if (event.key.toLowerCase() === "h") setControls(v => !v);
      if (event.key.toLowerCase() === "c") setCaptions(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const current = TOUR.find(s => s.id === app.scene);
  return <main className="mine min-h-dvh text-white">
    {controls && <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
      <Link href="/" className="flex min-h-11 items-center gap-2 rounded-full border-2 border-white/25 px-4 font-bold hover:bg-white/10"><ArrowLeft size={20} weight="bold" />CallCanary</Link>
      <span className="flex items-center gap-2 rounded-full bg-lamp px-3 py-1 text-sm font-extrabold uppercase tracking-[0.12em] text-coal"><VideoCamera size={18} weight="fill" />Product demo</span>
    </header>}
    <div className={cn("mx-auto grid max-w-6xl items-start gap-8 px-4 pb-10", controls ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "place-items-center pt-6")}>
      {controls && <aside className="order-2 grid gap-4 lg:order-1 lg:pt-6">
        <div className="grid gap-2">
          <h1 className="text-balance font-display text-[clamp(2.2rem,6vw,3.6rem)] font-extrabold leading-[0.95] tracking-[-0.025em] [font-stretch:86%]">CallCanary on your phone</h1>
          <p className="max-w-xl text-xl text-[#d6e2d0]">Play the tour to record a video, or tap a scene. The scam checks are real; Gmail access and blocking are simulated in this demo.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {app.touring ? <Button variant="destructive" size="lg" onClick={app.stop}><Stop weight="fill" />Stop tour</Button>
            : <Button variant="canary" size="lg" onClick={() => void app.playTour()}><Play weight="fill" />Play full tour</Button>}
          <Button variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={app.reset}><ArrowCounterClockwise weight="bold" />Reset</Button>
        </div>
        <ol className="grid gap-2">{TOUR.map((s, i) => { const on = app.scene === s.id; return <li key={s.id}>
          <button onClick={() => void app.playScene(s.id)} className={cn("flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
            on ? "border-lamp bg-lamp/15" : "border-white/15 hover:bg-white/5")}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold", on ? "bg-lamp text-coal" : "bg-white/10")}>{i + 1}</span>
            <span><strong className="block text-lg">{s.title}</strong><span className="block text-base text-[#c9d6c4]">{s.caption}</span></span>
          </button></li>; })}</ol>
        <div className="grid gap-3 rounded-2xl border-2 border-white/15 p-4">
          <div className="flex items-center gap-3"><Switch id="captions" checked={captions} onCheckedChange={setCaptions} /><Label htmlFor="captions" className="text-lg">Show captions for the video</Label></div>
          <Button variant="ghost" className="justify-start text-white hover:bg-white/10" onClick={() => setControls(false)}><EyeSlash weight="bold" />Hide controls for recording (press H)</Button>
          <p className="text-base text-[#c9d6c4]">For your video: email, text, website and call verdicts come from CallCanary&apos;s real checks and AI. Reading Gmail, blocking numbers and blocking websites on a phone would need the CallCanary mobile app, so this demo shows them without changing anything.</p>
        </div>
      </aside>}
      <div className={cn("order-1 grid w-full justify-items-center gap-4 lg:order-2", !controls && "max-w-[440px]")}>
        {/* The phone: a device frame on larger screens, edge to edge on a phone. */}
        <div className="h-[min(820px,calc(100dvh-230px))] min-h-[580px] w-full max-w-[400px] rounded-[52px] bg-[#0a0f0c] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_0_2px_rgba(255,255,255,0.08)] max-sm:h-[calc(100dvh-24px)] max-sm:rounded-[28px] max-sm:p-1.5">
          <div className="relative h-full overflow-hidden rounded-[42px] max-sm:rounded-[24px]">
            <PhoneApp app={app} />
            <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-2 z-50 h-6 w-28 -translate-x-1/2 rounded-full bg-black max-sm:hidden" />
          </div>
        </div>
        <AnimatePresence mode="wait">{captions && current && <motion.p key={current.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          className="max-w-md text-balance rounded-2xl bg-black/45 px-5 py-3 text-center font-display text-xl font-extrabold leading-snug backdrop-blur" aria-live="polite">{current.caption}</motion.p>}</AnimatePresence>
        {!controls && <button onClick={() => setControls(true)} className="flex items-center gap-2 rounded-full px-3 py-1 text-sm text-white/40 hover:text-white/80"><Eye size={16} />Show controls (H)</button>}
      </div>
    </div>
  </main>;
}
