import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// FTC Do Not Call "reported calls" index, built by scripts/build-ftc-index.mjs and shipped with the app.
// Reported means a consumer complained about the number, not that fraud was proven. Numbers can also be spoofed.
export const INDEX_PATH = path.join(process.cwd(), "data", "ftc-reported-numbers.tsv.gz");
export type NumberCheck =
  | { status: "invalid"; number: null }
  | { status: "unavailable"; number: string; detail: string }
  | { status: "not_reported"; number: string; from: string; to: string }
  | { status: "reported"; number: string; reports: number; robocall_reports: number; last_reported: string; topic: string; from: string; to: string };

import { normalizeUsNumber } from "./phoneNumber";
export { formatUsNumber, normalizeUsNumber } from "./phoneNumber";

type Index = { from: string; to: string; subjects: string[]; phones: Float64Array; reports: Uint32Array; last: Uint32Array; robo: Uint32Array; topic: Uint16Array };
let cached: Index | undefined;
export function parseIndex(gz: Buffer): Index {
  const text = zlib.gunzipSync(gz).toString("utf8");
  const newline = text.indexOf("\n");
  const header = JSON.parse(text.slice(0, newline));
  const rows = text.slice(newline + 1).split("\n").filter(Boolean);
  const index: Index = { from: header.from, to: header.to, subjects: header.subjects, phones: new Float64Array(rows.length), reports: new Uint32Array(rows.length),
    last: new Uint32Array(rows.length), robo: new Uint32Array(rows.length), topic: new Uint16Array(rows.length) };
  rows.forEach((row, i) => {
    const [phone, reports, last, robo, topic] = row.split("\t");
    index.phones[i] = Number(phone); index.reports[i] = Number(reports); index.last[i] = Number(last.replace(/-/g, ""));
    index.robo[i] = Number(robo); index.topic[i] = Number(topic);
  });
  return index;
}
function loadIndex(): Index {
  if (!cached) cached = parseIndex(fs.readFileSync(INDEX_PATH));
  return cached;
}
/** For tests: use a specific index instead of the shipped file. */
export function useIndexForTests(gz: Buffer | undefined) { cached = gz ? parseIndex(gz) : undefined; }

export function checkReportedNumber(input: unknown): NumberCheck {
  const number = normalizeUsNumber(input);
  if (!number) return { status: "invalid", number: null };
  let index: Index;
  // Fails open: a missing or broken index must never block (or falsely flag) a call.
  try { index = loadIndex(); } catch { return { status: "unavailable", number, detail: "The reported-numbers list could not be loaded." }; }
  const target = Number(number);
  let low = 0; let high = index.phones.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (index.phones[mid] === target) {
      const last = String(index.last[mid]);
      return { status: "reported", number, reports: index.reports[mid], robocall_reports: index.robo[mid],
        last_reported: `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6)}`, topic: index.subjects[index.topic[mid]] || "Other", from: index.from, to: index.to };
    }
    if (index.phones[mid] < target) low = mid + 1; else high = mid - 1;
  }
  return { status: "not_reported", number, from: index.from, to: index.to };
}
