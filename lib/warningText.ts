import type { Analysis } from "./analysis";
import { WARNING_SCRIPT } from "./demoTranscripts";
export type SpokenLevel = Analysis["level"];
// One short sentence per reason keeps the explanation brief enough to follow on a live call.
function brief(reason: string) {
  const clean = reason.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.{20,}?[.!?](?=\s|$)/)?.[0] || clean;
  const clipped = sentence.length > 180 ? sentence.slice(0, 180).replace(/\s+\S*$/, "") : sentence;
  return clipped.replace(/[.!?]+$/, "") + ".";
}
// The canary's lines: calm, protective, plain words. The reasons always come from this verdict.
export function warningText(reasons: string[] = [], level: SpokenLevel = "scam") {
  const why = reasons.filter(reason => reason.trim()).slice(0, level === "scam" ? 3 : 2).map(brief).join(" ");
  if (level === "safe") return `It's CallCanary. That part of the call sounded okay. ${why || "I didn't hear warning signs."} I'll keep listening.`;
  if (level === "suspicious") return `It's CallCanary. Something about this call doesn't sit right. ${why} Slow down. Don't send money or share any codes until you check with someone you trust.`;
  if (!why) return WARNING_SCRIPT;
  return `Hold on. It's CallCanary. I'm sure this call is a scam. ${why} Don't send money, and don't share any codes. Hang up, and call someone you trust.`;
}
