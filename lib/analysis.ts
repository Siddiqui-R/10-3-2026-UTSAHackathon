export const scamTypes = ["irs", "romance", "tech_support", "lottery", "phishing", "none", "other"] as const;
export type Analysis = {
  risk_score: number; level: "safe" | "suspicious" | "scam";
  scam_type: typeof scamTypes[number]; reasons: string[];
  red_flags: { phrase: string; explanation: string }[];
};
export const SYSTEM_PROMPT = "You are a fraud-detection expert protecting elderly phone users from scams: fake IRS/tax calls, romance scams, tech-support scams, lottery scams, and phishing. Analyze the call transcript. Score risk 0-100. Levels: safe (0-39: normal conversation), suspicious (40-69: some pressure tactics but inconclusive), scam (70-100: clear fraud patterns). Be conservative: a normal family call is safe. Keywords alone are not proof — judge who is asking whom to do what. People discussing, warning about or retelling scams (news stories, advice to a relative, refusing a scammer) are not being scammed: rate that safe unless someone in the call is actually being pushed to pay, share codes or grant access. Transcripts come from speech recognition and may contain errors or a 'Live captions also heard' note; treat both as the same call. Reasons must be one short, plain sentence each, written to the listener, naming what the caller actually said or asked for. Explain every reason in SIMPLE language a 70-year-old understands — no jargon. Return STRICT JSON only, no markdown, matching the schema.";
export const responseSchema = {
  type: "object", properties: {
    risk_score: { type: "integer", minimum: 0, maximum: 100 },
    level: { type: "string", enum: ["safe", "suspicious", "scam"] },
    scam_type: { type: "string", enum: scamTypes },
    reasons: { type: "array", items: { type: "string" } },
    red_flags: { type: "array", items: { type: "object", properties: {
      phrase: { type: "string" }, explanation: { type: "string" },
    }, required: ["phrase", "explanation"] } },
  }, required: ["risk_score", "level", "scam_type", "reasons", "red_flags"],
};
export const inconclusive: Analysis = { risk_score: 50, level: "suspicious", scam_type: "none",
  reasons: ["The safety check was inconclusive — stay cautious."], red_flags: [] };
export function parseAnalysis(text: string, transcript: string): Analysis | null {
  try {
    const value = JSON.parse(text);
    if (!value || !Number.isInteger(value.risk_score) || value.risk_score < 0 || value.risk_score > 100 ||
      !scamTypes.includes(value.scam_type) || !Array.isArray(value.reasons) || !value.reasons.length ||
      !value.reasons.every((r: unknown) => typeof r === "string" && r.trim()) ||
      !Array.isArray(value.red_flags) || !value.red_flags.every((f: { phrase?: unknown; explanation?: unknown }) =>
        f && typeof f.phrase === "string" && f.phrase.trim() && typeof f.explanation === "string" && f.explanation.trim())) return null;
    const level = value.risk_score < 40 ? "safe" : value.risk_score < 70 ? "suspicious" : "scam";
    if (value.level !== level) return null;
    const normalize = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
    const flags = value.red_flags.filter((f: { phrase: string }) => normalize(transcript).includes(normalize(f.phrase)));
    if (level === "scam" && !flags.length) return null;
    return { risk_score: value.risk_score, level, scam_type: value.scam_type,
      reasons: value.reasons.slice(0, 6).map((r: string) => r.slice(0, 500)),
      red_flags: flags.slice(0, 8).map((f: { phrase: string; explanation: string }) => ({ phrase: f.phrase.slice(0, 300), explanation: f.explanation.slice(0, 500) })) };
  } catch { return null; }
}
