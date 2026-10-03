export type ScamSignal = { id: string; label: string; phrase: string; weight: number; note?: "negated" | "discussion" };
type Rule = {
  id: string; label: string; weight: number; patterns: RegExp[];
  group?: "payment" | "pressure";
};
const GIFT_CARD = "(?:gift ?cards?|itunes cards?|google play cards?|prepaid cards?|steam cards?)";
const rules: Rule[] = [
  { id: "gift", label: "Gift-card payment", weight: 35, group: "payment", patterns: [
    new RegExp(String.raw`\bpay(?:ing|ment)? (?:\w+ ){0,4}(?:with|in|using|by|through) (?:\w+ ){0,2}${GIFT_CARD}`),
    new RegExp(String.raw`\b(?:buy|purchase|get|pick up) (?:\w+ ){0,4}${GIFT_CARD} (?:\w+ ){0,6}(?:and|then) (?:read|give|send|call|scratch|text|take a picture)`),
    new RegExp(String.raw`\bgo to (?:the )?(?:walmart|target|cvs|walgreens|store|kroger|heb|best buy|dollar general) (?:and )?(?:buy|get|purchase) (?:\w+ ){0,4}(?:cards?|${GIFT_CARD})`),
    new RegExp(String.raw`${GIFT_CARD} (?:\w+ ){0,3}(?:numbers?|codes?|pins?|back of)`),
    /\b(?:scratch (?:off )?the (?:back|silver)|read me the (?:numbers|codes?) on the (?:back|card))/,
  ] },
  { id: "gift-mention", label: "Gift cards mentioned", weight: 15, patterns: [/\b(?:gift ?cards?|itunes cards?|google play cards?|prepaid cards?)\b/] },
  { id: "wire", label: "Money transfer request", weight: 25, group: "payment", patterns: [
    /\bwire (?:me |us |him |her )?(?:the |your |that |this )?(?:money|funds|\w+ (?:thousand|hundred)|transfer|it)\b/, /\bwire transfer\b/,
    /\bsend (?:me |us |him |her )?(?:the )?(?:money|cash|funds|\w+ (?:thousand|hundred) dollars)\b/,
    /\b(?:western union|moneygram|money gram)\b/,
    /\b(?:transfer|move) (?:the |your |all (?:of )?(?:the |your )?)?(?:money|savings|funds)\b/,
    /\b(?:zelle|cash ?app|venmo) (?:me|it|the money|us)\b/,
  ] },
  { id: "cash", label: "Cash pickup or courier", weight: 35, group: "payment", patterns: [
    /\b(?:courier|driver|someone) (?:will|is going to|can) (?:come|stop by) (?:and )?(?:pick up|collect|get) (?:the )?(?:cash|money|package)/,
    /\b(?:put|mail|hide) (?:the )?cash (?:in|inside) (?:a |an )?(?:box|envelope|book|magazine)/,
  ] },
  { id: "crypto", label: "Crypto payment", weight: 35, group: "payment", patterns: [
    /\b(?:bitcoin|btc|crypto(?: ?currency)?) (?:atm|machine|kiosk|wallet address)\b/,
    /\b(?:pay|send|deposit|put|convert|buy|move) (?:\w+ ){0,5}(?:in(?:to)? |as |with |using )?(?:bitcoin|crypto(?: ?currency)?|usdt|tether)\b/,
  ] },
  { id: "crypto-mention", label: "Cryptocurrency mentioned", weight: 15, patterns: [/\b(?:bitcoin|crypto(?: ?currency)?|usdt|tether)\b/] },
  { id: "threat", label: "Threat of arrest or legal trouble", weight: 30, group: "pressure", patterns: [
    /\bwarrant\b/, /\b(?:arrest(?:ed)?|go to jail|be jailed|police (?:will|are going to) come|deport(?:ed|ation)?|lawsuit (?:against|filed))\b/,
    /\b(?:social security number|ssn) (?:has been |is |was )?(?:suspended|frozen|compromised|blocked)\b/,
  ] },
  { id: "authority", label: "Claims to be an official", weight: 10, patterns: [
    /\b(?:irs|internal revenue service|federal (?:matter|agent|agency)|social security administration|medicare (?:office|department)|sheriff'?s? (?:office|department)|u ?s ?marshal|fbi|dea|customs (?:and border|office))\b/,
  ] },
  { id: "tech-brand", label: "Unexpected tech support", weight: 15, patterns: [
    /\b(?:microsoft|apple|windows|amazon|geek squad) (?:support|security|technician|department|refund)\b/,
    /\byour (?:computer|device|account|phone) (?:has been |is |was )?(?:hacked|infected|compromised|has a virus)\b/,
  ] },
  { id: "secrecy", label: "Keep it secret", weight: 25, patterns: [
    /\b(?:do not|don'?t|dont|never) (?:tell|mention (?:this|it) to|talk to) (?:anyone|anybody|your (?:kids|children|family|son|daughter|husband|wife|bank|teller)|mom|dad|the bank)\b(?! (?:your|the) (?:pin|password|code|social|account|card))/,
    /\bkeep (?:this|it) (?:a )?(?:secret|between us|quiet|confidential)\b/,
    /\b(?:if the bank|if the teller|if anyone) asks?,? (?:say|tell them)\b/,
  ] },
  { id: "urgent", label: "Pressure to act now", weight: 15, group: "pressure", patterns: [
    /\b(?:pay (?:it )?(?:immediately|right now|today)|time is running out|act (?:now|fast|immediately)|right away or|within the (?:next )?(?:hour|\w+ minutes)|must pay|today only|last chance|before it'?s too late)\b/,
    /\b(?:do not|don'?t|dont) hang up\b/, /\bstay on the (?:line|phone)\b/,
  ] },
  { id: "code", label: "Asks for codes, passwords or ID numbers", weight: 35, patterns: [
    /\b(?:tell|give|read|send|share|confirm|verify|provide) (?:me |us )?(?:back )?(?:your |the |that )?(?:\w+ )?(?:password|pin(?: number)?|verification code|security code|confirmation code|one[- ]?time (?:code|passcode|password)|code (?:we|i) (?:just )?(?:sent|texted))\b/,
    /\b(?:what is|what'?s) your (?:social security number|ssn|bank account number|account number|routing number|card number|pin|password)\b/,
    /\b(?:need|confirm|verify|read me) (?:your |the )?(?:full )?(?:social security number|bank account number|card number|medicare number)\b/,
  ] },
  { id: "remote", label: "Remote access to a device", weight: 35, patterns: [
    /\b(?:anydesk|any desk|teamviewer|team viewer|ultraviewer|logmein|screen ?connect|remote access|remote desktop|quick ?assist)\b/,
    /\b(?:download|install) (?:this |the |an |a )?(?:app|software|program|application) (?:so (?:i|we) can|to (?:fix|remove|secure))\b/,
  ] },
  { id: "relative", label: "Family emergency money story", weight: 25, patterns: [
    /\b(?:grandma|grandpa|nana|grandmother|grandfather),? (?:it'?s me|i'?m in (?:trouble|jail))/,
    /\b(?:need|send|pay) (?:\w+ )?(?:bail|bail money|lawyer'?s? fees?|hospital bill)\b/, /\bi'?m in jail\b/,
  ] },
  { id: "romance", label: "Overseas money story", weight: 15, patterns: [
    /\b(?:bank froze my account|fly home to you|stranded (?:overseas|abroad)|stuck (?:overseas|abroad)|account (?:is |was |has been )?frozen|customs (?:fee|is holding)|oil rig)\b/,
  ] },
  { id: "package", label: "Unexpected delivery fee", weight: 35, patterns: [
    /\b(?:redelivery fee|package (?:could not|couldn'?t|cannot) be delivered|usps[- ]?track|update your (?:address|delivery) (?:and|to) pay)\b/,
  ] },
  { id: "prize", label: "Pay to claim a prize or refund", weight: 35, group: "payment", patterns: [
    /\b(?:pay|send) (?:a |the |\w+ )?(?:fee|taxes?|processing (?:fee|charge)) (?:to|so you can|before you can) (?:claim|collect|receive|release)\b/,
    /\byou(?:'ve| have)? (?:won|been selected for) (?:the |a |our )?(?:lottery|sweepstakes|prize|grand prize|jackpot|cash prize)\b/,
    /\b(?:refund|overpaid you|sent you too much)\b.{0,60}\b(?:send|pay|give) (?:it |the difference |us )?back\b/,
  ] },
];
// Reassurance ("don't worry, just pay…") is a pressure tactic, not a negation of what follows.
const REASSURANCE = /\b(?:don'?t|do not|dont) (?:worry|panic|be scared|be afraid)\b|\bno (?:problem|worries)\b|\bnot a problem\b/g;
const NEGATORS = /\b(?:not|never|don'?t|dont|doesn'?t|won'?t|will not|wouldn'?t|can'?t|cannot|isn'?t|aren'?t|nobody|no one|refuse|refused|didn'?t)\b/;
// Reported speech ("they'll say", "if someone asks you to") marks advice even when the quoted words are a direct demand.
const REPORTED = /\b(?:they(?:'ll| will| might| may| would)? (?:say|ask|tell you)|will say|might say|would say|asks? you to|if (?:someone|anyone|a caller|they) (?:asks?|tells?|says?))b/;
// Talking *about* scams (news, warnings, family advice) rather than being targeted by one.
const DISCUSSION = /\b(?:scams?|scammers?|scammed|con artists?|fraudsters?|hoax|on the news|news (?:said|story|report)|article|read about|heard about|warned (?:me|us|you)|warning about|watch out for|be careful (?:of|about|with)|they (?:tried|try) to|tried to trick|trying to trick|fake call|fake caller|pretend(?:ed|ing)? to be|pretend|the bank will never|will never (?:call|ask)|never ask(?:s)? for)\b/;
export const SIGNAL_THRESHOLD = 35;
export const EVIDENCE_WINDOW_MS = 40_000;
export function normalizeSpeech(text: string) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9'$ ]+/g, " ").replace(/\s+/g, " ").trim();
}
function contextBefore(text: string, index: number, words: number) {
  return text.slice(0, index).split(" ").slice(-words).join(" ");
}
// These are investigation triggers, not fraud verdicts. Each rule contributes once per window, so repeating a
// phrase cannot inflate the score. Negated or discussion-context phrases still show but carry reduced weight.
export function scoreSignals(text: string): { score: number; signals: ScamSignal[] } {
  const normalized = normalizeSpeech(text);
  const signals: ScamSignal[] = [];
  const groups = new Set<string>();
  for (const rule of rules) {
    if (rule.id.endsWith("-mention") && signals.some(signal => signal.id === rule.id.replace("-mention", ""))) continue;
    let best: ScamSignal | undefined;
    for (const pattern of rule.patterns) {
      for (const match of normalized.matchAll(new RegExp(pattern.source, "g"))) {
        const index = match.index ?? 0;
        const near = contextBefore(normalized, index, 5).replace(REASSURANCE, " ");
        const sentence = normalized.slice(Math.max(0, index - 90), index + match[0].length + 60);
        let weight = rule.weight; let note: ScamSignal["note"];
        // A negator inside the match ("don't tell anyone") is the warning itself; only words before it negate it.
        const direct = /\b(?:me|us)\b/.test(match[0]) || /\byou (?:need|must|have) to\b/.test(near);
        const reported = REPORTED.test(contextBefore(normalized, index, 8));
        if (NEGATORS.test(near)) { weight = Math.round(weight * 0.2); note = "negated"; }
        else if (reported || (!direct && DISCUSSION.test(sentence))) { weight = Math.round(weight * 0.35); note = "discussion"; }
        if (!best || weight > best.weight) best = { id: rule.id, label: rule.label, phrase: match[0].trim(), weight, ...(note ? { note } : {}) };
      }
    }
    if (best) { signals.push(best); if (rule.group && !best.note) groups.add(rule.group); }
  }
  // Classic scam structure: a payment demand combined with pressure or a threat.
  if (groups.has("payment") && groups.has("pressure"))
    signals.push({ id: "combo", label: "Payment demand plus pressure", phrase: "payment + pressure", weight: 10 });
  return { score: Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0)), signals };
}
