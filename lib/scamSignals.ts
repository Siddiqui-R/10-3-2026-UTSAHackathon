export type ScamSignal = { id: string; label: string; phrase: string; weight: number };
const rules = [
  { id: "gift", label: "Gift-card payment", weight: 35, pattern: /\b(?:(?:apple|google play|amazon|steam) )?gift cards?\b/i },
  { id: "wire", label: "Money transfer", weight: 25, pattern: /\b(?:wire (?:me |the |your )?(?:money|\w+ thousand|\w+ hundred|transfer)|wire transfer|send (?:me |us )?money|transfer (?:the |your )?money)\b/i },
  { id: "crypto", label: "Crypto payment", weight: 30, pattern: /\b(?:bitcoin|crypto(?:currency)?|bitcoin atm)\b/i },
  { id: "threat", label: "Threat of arrest", weight: 30, pattern: /\b(?:warrant|arrest(?:ed)?|go to jail)\b/i },
  { id: "authority", label: "Government claim", weight: 10, pattern: /\b(?:irs|internal revenue service|federal matter|social security administration)\b/i },
  { id: "secrecy", label: "Keep it secret", weight: 25, pattern: /\b(?:do not tell anyone|don'?t tell (?:anyone|your (?:kids|children|family))|keep (?:this |it )?(?:a )?secret)\b/i },
  { id: "urgent", label: "Pressure to act", weight: 15, pattern: /\b(?:pay immediately|time is running out|act now|avoid arrest today|must pay|today only)\b/i },
  { id: "code", label: "Private codes or passwords", weight: 35, pattern: /\b(?:(?:tell|give|read|send|share) (?:me |us )?(?:your |the )?(?:password|pin|verification code|security code|one[- ]time (?:code|password))|social security number)\b/i },
  { id: "remote", label: "Remote access", weight: 35, pattern: /\b(?:anydesk|teamviewer|remote access|install (?:this |the )?(?:software|program))\b/i },
  { id: "romance", label: "Overseas money story", weight: 15, pattern: /\b(?:bank froze my account|fly home to you|stranded overseas|account (?:is |was )?frozen)\b/i },
  { id: "package", label: "Unexpected delivery fee", weight: 35, pattern: /\b(?:redelivery fee|package could not be delivered|usps[- ]track[- ]secure)\b/i },
  { id: "prize", label: "Pay to claim a prize", weight: 35, pattern: /\b(?:pay (?:a |the )?fee to (?:claim|collect)|you(?:'ve| have)? won (?:the |a )?(?:lottery|prize))\b/i },
] as const;
export const SIGNAL_THRESHOLD = 35;
export const EVIDENCE_WINDOW_MS = 40_000;
// These are review triggers, not fraud verdicts. Each rule contributes once per window.
export function scoreSignals(text: string): { score: number; signals: ScamSignal[] } {
  const normalized = text.replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  const signals = rules.flatMap(rule => {
    const match = normalized.match(rule.pattern);
    return match ? [{ id: rule.id, label: rule.label, phrase: match[0], weight: rule.weight }] : [];
  });
  return { score: Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0)), signals };
}
