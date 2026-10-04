import type { LinkFinding, LinkFlag, LinkVerdict, SenderFacts } from "./linkCheck";

export const EMAIL_SYSTEM_PROMPT = "You are a phishing-email expert protecting elderly users. You receive an email's text and a pre-computed link report. (1) Find every typo, misspelling, and grammar error scammers make — quote each one and give the correction (e.g. 'Recieve' should be 'Receive'). Real companies proofread; typos are a scam signal. (2) Judge each link from the link report in simple terms. (3) Check the sender: does the display name match the actual address? Is the reply-to different? (4) Flag pressure tactics: urgency, threats, secrecy, requests for passwords/gift cards/money. Explain everything in SIMPLE language a 70-year-old understands. Return STRICT JSON only.";

export const emailResponseSchema = {
  type: "object", properties: {
    risk_score: { type: "integer", minimum: 0, maximum: 100 },
    level: { type: "string", enum: ["safe", "suspicious", "phishing"] },
    typos: { type: "array", items: { type: "object", properties: {
      typo: { type: "string" }, correction: { type: "string" }, why_it_matters: { type: "string" },
    }, required: ["typo", "correction", "why_it_matters"] } },
    links: { type: "array", items: { type: "object", properties: {
      display_text: { type: "string" }, actual_url: { type: "string" },
      verdict: { type: "string", enum: ["safe", "suspicious", "malicious"] }, explanation: { type: "string" },
    }, required: ["display_text", "actual_url", "verdict", "explanation"] } },
    sender: { type: "object", properties: {
      display_name: { type: "string" }, address: { type: "string" }, spoofed: { type: "boolean" }, explanation: { type: "string" },
    }, required: ["display_name", "address", "spoofed", "explanation"] },
    pressure_tactics: { type: "array", items: { type: "string" } },
    recommended_action: { type: "string" },
  }, required: ["risk_score", "level", "typos", "links", "sender", "pressure_tactics", "recommended_action"],
};

export type EmailLevel = "safe" | "suspicious" | "phishing";
type AiEmail = {
  risk_score: number; level: EmailLevel;
  typos: { typo: string; correction: string; why_it_matters: string }[];
  links: { display_text: string; actual_url: string; verdict: LinkVerdict; explanation: string }[];
  sender: { display_name: string; address: string; spoofed: boolean; explanation: string };
  pressure_tactics: string[]; recommended_action: string;
};
export type EmailResult = {
  risk_score: number; level: EmailLevel;
  typos: AiEmail["typos"];
  links: { display_text: string; actual_url: string; actual_domain: string; shown_domain: string | null; verdict: LinkVerdict; explanation: string; flags: LinkFlag[] }[];
  sender: { display_name: string; address: string; reply_to: string; claimed_brand: string | null; spoofed: boolean; explanation: string } | null;
  pressure_tactics: string[]; recommended_action: string;
  /** False when the AI check was unavailable and only the code checks ran. */
  ai_checked: boolean;
};

const str = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const levelFor = (score: number): EmailLevel => score < 40 ? "safe" : score < 70 ? "suspicious" : "phishing";
/** Validate Gemini's JSON. Typos must be quoted from the email itself, so invented ones are dropped. */
export function parseEmailAnalysis(text: string, email: string): AiEmail | null {
  try {
    const value = JSON.parse(text);
    if (!value || !Number.isInteger(value.risk_score) || value.risk_score < 0 || value.risk_score > 100) return null;
    if (!Array.isArray(value.typos) || !Array.isArray(value.links) || !value.sender || typeof value.sender !== "object" || !Array.isArray(value.pressure_tactics)) return null;
    const lower = email.toLowerCase();
    const typos = value.typos.map((t: Record<string, unknown>) => ({ typo: str(t?.typo, 80), correction: str(t?.correction, 80), why_it_matters: str(t?.why_it_matters, 300) }))
      .filter((t: AiEmail["typos"][number]) => t.typo && t.correction && t.typo.toLowerCase() !== t.correction.toLowerCase() && lower.includes(t.typo.toLowerCase()))
      .slice(0, 15);
    const links = value.links.filter((l: Record<string, unknown>) => l && ["safe", "suspicious", "malicious"].includes(l.verdict as string))
      .map((l: Record<string, unknown>) => ({ display_text: str(l.display_text, 300), actual_url: str(l.actual_url, 500), verdict: l.verdict as LinkVerdict, explanation: str(l.explanation) }));
    return {
      risk_score: value.risk_score, level: levelFor(value.risk_score), typos, links,
      sender: { display_name: str(value.sender.display_name, 200), address: str(value.sender.address, 200), spoofed: value.sender.spoofed === true, explanation: str(value.sender.explanation) },
      pressure_tactics: value.pressure_tactics.map((p: unknown) => str(p, 300)).filter(Boolean).slice(0, 8),
      recommended_action: str(value.recommended_action, 400),
    };
  } catch { return null; }
}

const rank: Record<LinkVerdict, number> = { safe: 0, suspicious: 1, malicious: 2 };
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();
const defaultAction: Record<EmailLevel, string> = {
  phishing: "Do not click any links or reply. Delete this email. If you're worried about your account, open the company's app or type its website yourself.",
  suspicious: "Don't click the links. If you think it might be real, contact the company using the phone number on your card or their official website.",
  safe: "This looks okay, but only open links you were expecting.",
};
/**
 * Combine code findings (ground truth) with the AI's explanation. The AI can raise but never lower a link's verdict,
 * and a dangerous link or spoofed sender always makes the email at least as risky as the code says.
 */
export function mergeEmailVerdict(ai: AiEmail | null, report: { links: LinkFinding[]; sender: SenderFacts | null }): EmailResult {
  const links = report.links.map((finding, index) => {
    const match = ai?.links.find(l => sameUrl(l.actual_url, finding.actual_url)) || (ai?.links.length === report.links.length ? ai.links[index] : undefined);
    const verdict = match && rank[match.verdict] > rank[finding.verdict] ? match.verdict : finding.verdict;
    const codeWhy = finding.flags.filter(f => f.severity !== "info").map(f => f.message).join(" ");
    return {
      display_text: finding.display_text, actual_url: finding.actual_url, actual_domain: finding.actual_domain, shown_domain: finding.shown_domain,
      verdict, explanation: match?.explanation || codeWhy || "We found nothing wrong with this link, but only open it if you expected this email.", flags: finding.flags,
    };
  });
  const codeSender = report.sender;
  const sender = codeSender ? {
    display_name: codeSender.display_name, address: codeSender.address, reply_to: codeSender.reply_to, claimed_brand: codeSender.claimed_brand,
    spoofed: codeSender.spoofed || !!ai?.sender.spoofed,
    explanation: [codeSender.reasons.join(" "), ai?.sender.explanation].filter(Boolean)[0] || "The sender's name and address match.",
  } : ai?.sender.address.includes("@") ? { ...ai.sender, reply_to: "", claimed_brand: null } : null;
  let score = ai?.risk_score ?? 50;
  const worstLink = links.reduce((max, link) => Math.max(max, rank[link.verdict]), 0);
  if (worstLink === 2 || codeSender?.spoofed) score = Math.max(score, 85);
  else if (worstLink === 1) score = Math.max(score, 45);
  const level = levelFor(score);
  return {
    risk_score: score, level, typos: ai?.typos || [], links, sender, pressure_tactics: ai?.pressure_tactics || [],
    recommended_action: ai?.recommended_action || defaultAction[level], ai_checked: !!ai,
  };
}
