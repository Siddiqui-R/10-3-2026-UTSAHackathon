"use client";
// Recent checks, kept only in this browser. Entries hold short summaries (verdict, name, reason, number), never full
// transcripts, recordings or email text. The user can turn history off, delete one entry, or clear it all.
export type HistoryKind = "screen" | "number" | "email" | "call";
export type HistoryVerdict = "scam" | "careful" | "safe" | "info";
export type HistoryEntry = {
  id: string; at: string; kind: HistoryKind; verdict: HistoryVerdict; title: string;
  details: string[]; sample?: boolean;
};
const KEY = "callcanary.history";
const OFF_KEY = "callcanary.historyOff";
export const MAX_HISTORY = 50;
const CHANGED = "callcanary-history-changed";

export function historyEnabled() {
  try { return localStorage.getItem(OFF_KEY) !== "1"; } catch { return false; }
}
export function setHistoryEnabled(enabled: boolean) {
  try { if (enabled) localStorage.removeItem(OFF_KEY); else { localStorage.setItem(OFF_KEY, "1"); localStorage.removeItem(KEY); } } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(CHANGED));
}
export function loadHistory(): HistoryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value.filter(e => e && typeof e.id === "string" && typeof e.title === "string" && Array.isArray(e.details)) : [];
  } catch { return []; }
}
function store(entries: HistoryEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { /* storage full or blocked: history is optional */ }
  window.dispatchEvent(new Event(CHANGED));
}
/** Record a check. Does nothing when history is turned off or storage is unavailable. */
export function addHistory(entry: Omit<HistoryEntry, "id" | "at">) {
  if (!historyEnabled()) return;
  const clean: HistoryEntry = {
    ...entry, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(),
    title: entry.title.slice(0, 120), details: entry.details.filter(Boolean).map(d => d.slice(0, 200)).slice(0, 4),
  };
  store([clean, ...loadHistory()]);
}
export function removeHistory(id: string) { store(loadHistory().filter(entry => entry.id !== id)); }
export function clearHistory() { store([]); }
export function onHistoryChange(listener: () => void) {
  window.addEventListener(CHANGED, listener); window.addEventListener("storage", listener);
  return () => { window.removeEventListener(CHANGED, listener); window.removeEventListener("storage", listener); };
}
