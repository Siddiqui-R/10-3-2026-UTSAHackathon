"use client";
import { useEffect, useState } from "react";
export default function RiskMeter({ score, label = "Call risk", signals = false }: { score: number | null; label?: string; signals?: boolean }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    setDisplay(0);
    if (score === null) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 900);
      setDisplay(Math.round(score * progress));
      if (progress === 1) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [score]);
  const color = display < (signals ? 35 : 40) ? "#176b40" : display < 70 ? "#906000" : "#b91c24";
  return <div className="risk-gauge" aria-label={score === null ? "Waiting for call analysis" : `Risk score ${score} out of 100`}>
    <div className="gauge-heading"><span>{label.toUpperCase()}</span><strong style={{ color }}>{score === null ? "—" : display}<small>/100</small></strong></div>
    <div className="gauge-track" role={score === null ? undefined : "meter"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined} aria-label={label}>
      {score !== null && <span style={{ width: `${display}%`, background: color }} />}
    </div>
    <div className="gauge-labels"><span>{signals ? "Few signals" : "Safe"}</span><span>{signals ? "Review" : "Caution"}</span><span>{signals ? "Many signals" : "Scam"}</span></div>
  </div>;
}
