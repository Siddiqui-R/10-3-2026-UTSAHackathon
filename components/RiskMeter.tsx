"use client";
import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
export default function RiskMeter({ score, label = "Call risk", signals = false, tone = "light" }: { score: number | null; label?: string; signals?: boolean; tone?: "light" | "dark" }) {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (score === null) { setDisplay(0); return; }
    if (reduce) { setDisplay(score); return; }
    const controls = animate(0, score, { duration: 0.9, ease: "easeOut", onUpdate: value => setDisplay(Math.round(value)) });
    return () => controls.stop();
  }, [score, reduce]);
  const level = display < (signals ? 35 : 40) ? "low" : display < 70 ? "mid" : "high";
  const fill = { low: "bg-safe", mid: "bg-warn", high: "bg-danger" }[level];
  const text = { low: "text-safe", mid: "text-warn", high: "text-danger" }[level];
  return <div className={cn("w-full rounded-xl p-4", tone === "dark" ? "bg-white text-foreground" : "bg-muted/60")} aria-label={score === null ? "Waiting for call analysis" : `${label}: ${score} out of 100`}>
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <strong className={cn("font-display text-4xl font-extrabold tabular-nums", text)}>{score === null ? "—" : display}<small className="ml-0.5 text-base text-muted-foreground">/100</small></strong>
    </div>
    <div className="mt-2 h-4 overflow-hidden rounded-full bg-[linear-gradient(90deg,hsl(var(--safe-soft))_0_35%,hsl(var(--warn-soft))_35%_70%,hsl(var(--danger-soft))_70%)]"
      role={score === null ? undefined : "meter"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} aria-label={label}>
      {score !== null && <motion.span className={cn("block h-full rounded-full", fill)} style={{ width: `${display}%` }} />}
    </div>
    <div className="mt-1.5 flex justify-between text-base text-muted-foreground"><span>{signals ? "Few signals" : "Safe"}</span><span>{signals ? "Review" : "Caution"}</span><span>{signals ? "Many signals" : "Scam"}</span></div>
  </div>;
}
