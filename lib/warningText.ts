import { WARNING_SCRIPT } from "./demoTranscripts";
export function warningText(reasons: string[] = []) {
  if (!reasons.length) return WARNING_SCRIPT;
  return `I'm CallCanary. This is a scam. Here's why. ${reasons.map(reason => reason.replace(/[\r\n]/g, " ").trim().replace(/[.!?]+$/, "") + ".").join(" ")} Do not send money or share personal information. Hang up, then block this number. Call someone you trust.`;
}
