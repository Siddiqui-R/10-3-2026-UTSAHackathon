"use client";
import Image from "next/image";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
export type MascotMood = "sleeping" | "alert" | "concerned" | "warning" | "speaking";
const descriptions: Record<MascotMood, string> = {
  sleeping: "CallCanary asleep — protection is off",
  alert: "CallCanary awake and listening, your masked yellow canary protector",
  concerned: "CallCanary looking concerned while it checks the call",
  warning: "CallCanary on alert with a scam warning",
  speaking: "CallCanary speaking its warning",
};
const sizes = { sm: "size-24", md: "size-40", lg: "size-56" } as const;
// Two drawings, five moods: motion and a small badge carry the difference, and still read with reduced motion.
export default function Mascot({ mood, size = "lg", className }: { mood: MascotMood; size?: keyof typeof sizes; className?: string }) {
  const urgent = mood === "warning" || mood === "speaking";
  return <motion.div key={urgent ? "urgent" : "calm"} role="img" aria-label={descriptions[mood]}
    className={cn("canary relative shrink-0", sizes[size], `mascot-${mood}`, className)}
    initial={urgent ? { opacity: 0, y: 40, scale: 0.7 } : false} animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: "spring", stiffness: 260, damping: 16 }}>
    {mood === "alert" && <span className="mascot-ears" aria-hidden="true" />}
    {mood === "concerned" && <span className="mascot-badge mascot-badge-concerned" aria-hidden="true">?</span>}
    {urgent && <span className="mascot-badge mascot-badge-warning" aria-hidden="true">!</span>}
    <Image src={mood === "sleeping" ? "/mascot-sleeping.png" : "/mascot.png"} alt="" fill sizes="224px" className="object-contain" priority />
  </motion.div>;
}
