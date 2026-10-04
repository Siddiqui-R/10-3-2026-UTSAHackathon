import { normalizeUsNumber } from "./phoneNumber";

// Trusted contacts: family and friends saved on this device. Screening compares the name a caller gives with this
// list and with the number they're calling from — "Grandma, it's Jake" from a number that isn't Jake's is the classic
// family-emergency scam. Contacts are sent with a screen request but never stored on the server or sent to the AI.
export type TrustedContact = { name: string; phone: string | null };
export type ContactMatch = { contact: TrustedContact; heard: string; exact: boolean };
export const MAX_CONTACTS = 30;
// Speech-to-text often mishears names ("Jake" → "Jack"). Jaro-Winkler at this level catches those without
// matching unrelated names.
export const NAME_MATCH_MIN = 0.86;

export function sanitizeContacts(value: unknown): TrustedContact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const name = typeof item?.name === "string" ? item.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    return /[a-z]/i.test(name) ? [{ name, phone: normalizeUsNumber(item?.phone) }] : [];
  }).slice(0, MAX_CONTACTS);
}

export function jaroWinkler(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false); const bMatched = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0; let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

// Words that follow "this is" / "it's" but aren't names ("it's an emergency", "this is about your account").
const NOT_NAMES = new Set(["a", "an", "the", "me", "us", "your", "you", "my", "about", "calling", "just", "not", "here", "from", "trying", "sorry", "so",
  "really", "very", "in", "at", "on", "with", "going", "looking", "having", "currently", "actually", "glad", "happy", "afraid", "worried", "fine",
  "good", "okay", "ok", "sure", "urgent", "important", "emergency", "him", "her", "them", "it", "that", "what", "who", "how", "why", "when", "where",
  "yes", "no", "officer", "agent", "detective", "grandma", "grandpa", "mom", "dad", "nana", "papa", "mr", "mrs", "ms", "dr", "doctor", "regarding",
  "concerning", "important", "time", "been", "really", "been", "kind", "possible", "now", "too", "late"]);
const SLOT = /\b(?:my name is|my name's|the name is|this is|it's|it is|i'm|i am)\s+(?:(?:officer|agent|detective|mr|mrs|ms|dr|doctor|your (?:grandson|granddaughter|nephew|niece|son|daughter))\.?\s+)?([a-z][a-z'’-]*)/gi;
const TRAILING = /\b([A-Z][a-z'’-]+)\s+(?:here|speaking|calling)\b/g;
/** Names the caller gave for themselves ("it's Jake", "this is Officer Daniels", "Sarah here"), plus the AI's reading. */
export function statedNames(transcript: string, aiName = ""): string[] {
  const names = [...transcript.matchAll(SLOT)].map(m => m[1]).concat([...transcript.matchAll(TRAILING)].map(m => m[1]));
  if (aiName) names.unshift(...aiName.split(/\s+/));
  return [...new Set(names.map(name => name.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z-]/g, "")).filter(name => name.length >= 2 && !NOT_NAMES.has(name)))];
}
/** The saved contact the caller claims to be, if any. */
export function matchContact(names: string[], contacts: TrustedContact[]): ContactMatch | null {
  let best: (ContactMatch & { score: number }) | null = null;
  for (const heard of names) {
    for (const contact of contacts) {
      for (const part of contact.name.toLowerCase().split(/[\s-]+/).filter(p => p.length >= 2)) {
        const score = jaroWinkler(heard, part);
        if (score >= NAME_MATCH_MIN && (!best || score > best.score)) best = { contact, heard, exact: score === 1, score };
      }
    }
  }
  return best && { contact: best.contact, heard: best.heard, exact: best.exact };
}
