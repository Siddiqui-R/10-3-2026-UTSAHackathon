"use client";
import { MotionConfig } from "motion/react";

// Every Motion animation follows the device's "reduce motion" setting.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
