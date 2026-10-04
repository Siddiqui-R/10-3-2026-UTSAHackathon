"use client";
import type { EmailResult } from "./emailAnalysis";
// Saved email reports. For now they live only in this browser; a shared database can replace saveReport later
// without changing the page. Callers must describe where the report went from the returned value, never assume.
const KEY = "callcanary.emailReports";
const MAX_REPORTS = 20;
export type SavedReport = {
  saved_at: string; level: EmailResult["level"]; risk_score: number; sender: string;
  links: { actual_url: string; shown: string; verdict: string }[];
};
export function saveReport(result: EmailResult): { saved: "device"; count: number } | { saved: false } {
  const report: SavedReport = {
    saved_at: new Date().toISOString(), level: result.level, risk_score: result.risk_score, sender: result.sender?.address || "",
    links: result.links.map(link => ({ actual_url: link.actual_url, shown: link.shown_domain || link.display_text, verdict: link.verdict })),
  };
  try {
    const existing: SavedReport[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    const next = [report, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_REPORTS);
    localStorage.setItem(KEY, JSON.stringify(next));
    return { saved: "device", count: next.length };
  } catch { return { saved: false }; }
}
