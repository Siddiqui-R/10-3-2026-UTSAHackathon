// Builds data/ftc-reported-numbers.tsv.gz from the FTC's public Do Not Call "reported calls" daily files.
//   node scripts/build-ftc-index.mjs [days=30]
// Each line: phone<TAB>reports<TAB>lastReported(YYYY-MM-DD)<TAB>robocallReports<TAB>topSubjectIndex
// Line 1 is a JSON header with the date range and the subject list. Re-run and redeploy to refresh.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const days = Number(process.argv[2] || 30);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const out = path.join(root, "data", "ftc-reported-numbers.tsv.gz");

// Minimal CSV line parser (quoted fields may contain commas).
function parseLine(line) {
  const fields = []; let field = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"' && line[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; }
    else if (c === '"') quoted = true; else if (c === ",") { fields.push(field); field = ""; } else field += c;
  }
  fields.push(field); return fields;
}

const numbers = new Map(); // phone -> { reports, last, robo, subjects: Map }
const loaded = [];
for (let back = 1; back <= days; back++) {
  const date = new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
  const url = `https://www.ftc.gov/sites/default/files/DNC_Complaint_Numbers_${date}.csv`;
  const response = await fetch(url, { headers: { "User-Agent": "CallCanary data loader" } });
  const text = response.ok ? await response.text() : "";
  // Missing days (weekends, holidays) return 404 or an HTML page.
  if (!text.startsWith("Company_Phone_Number")) { console.log(`${date}: no file`); continue; }
  let rows = 0;
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [phoneRaw, created, , , , , subject = "", robocall = ""] = parseLine(line);
    const phone = phoneRaw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (!/^[2-9]\d{9}$/.test(phone)) continue;
    const entry = numbers.get(phone) || { reports: 0, last: "", robo: 0, subjects: new Map() };
    entry.reports++; rows++;
    const day = (created || date).slice(0, 10);
    if (day > entry.last) entry.last = day;
    if (robocall.trim().toUpperCase() === "Y") entry.robo++;
    const topic = subject.replace(/\s+/g, " ").trim() || "Other";
    entry.subjects.set(topic, (entry.subjects.get(topic) || 0) + 1);
    numbers.set(phone, entry);
  }
  loaded.push(date); console.log(`${date}: ${rows} reports`);
}
if (!loaded.length) { console.error("No FTC files could be downloaded; index not written."); process.exit(1); }
const subjects = [];
const subjectIndex = topic => { let i = subjects.indexOf(topic); if (i < 0) { subjects.push(topic); i = subjects.length - 1; } return i; };
const lines = [...numbers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([phone, e]) => {
  const top = [...e.subjects.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return `${phone}\t${e.reports}\t${e.last}\t${e.robo}\t${subjectIndex(top)}`;
});
loaded.sort();
const header = { source: "FTC Do Not Call Reported Calls Data", from: loaded[0], to: loaded.at(-1), files: loaded.length, numbers: lines.length, subjects, built: new Date().toISOString() };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(header) + "\n" + lines.join("\n") + "\n", { level: 9 }));
console.log(`Wrote ${lines.length} numbers from ${loaded.length} files (${header.from} to ${header.to}): ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
