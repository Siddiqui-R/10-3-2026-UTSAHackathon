// Deterministic link and sender checks. This is the ground truth for links; the AI only explains it.
export type LinkVerdict = "safe" | "suspicious" | "malicious";
export type LinkFlag = { code: string; severity: LinkVerdict | "info"; message: string };
export type ExtractedLink = { display_text: string; href: string };
export type LinkFinding = {
  display_text: string; actual_url: string; actual_domain: string; shown_domain: string | null;
  verdict: LinkVerdict; flags: LinkFlag[];
};
export type SenderFacts = {
  display_name: string; address: string; reply_to: string; claimed_brand: string | null; spoofed: boolean; reasons: string[];
};

export const KNOWN_BRANDS = ["paypal", "usps", "irs", "amazon", "apple", "microsoft", "chase", "bankofamerica", "wellsfargo", "fedex", "netflix"] as const;
type Brand = typeof KNOWN_BRANDS[number];
const OFFICIAL: Record<Brand, string[]> = {
  paypal: ["paypal.com", "paypal.me", "paypalobjects.com"], usps: ["usps.com", "usps.gov"], irs: ["irs.gov"],
  amazon: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazonaws.com", "amazon.jobs", "a.co"],
  apple: ["apple.com", "icloud.com", "me.com", "apple.news"], microsoft: ["microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "office365.com", "xbox.com"],
  chase: ["chase.com", "jpmorganchase.com", "jpmorgan.com"], bankofamerica: ["bankofamerica.com", "bofa.com", "ml.com"],
  wellsfargo: ["wellsfargo.com", "wf.com"], fedex: ["fedex.com"], netflix: ["netflix.com", "nflxext.com"],
};
// How each brand appears in names and link text ("Bank of America", "Wells Fargo").
const BRAND_NAMES: Record<Brand, RegExp> = {
  paypal: /\bpay\s?pal\b/i, usps: /\b(?:usps|postal service|post office)\b/i, irs: /\b(?:irs|internal revenue)\b/i, amazon: /\bamazon\b/i,
  apple: /\b(?:apple|icloud)\b/i, microsoft: /\b(?:microsoft|outlook|office ?365)\b/i, chase: /\bchase\b/i,
  bankofamerica: /\bbank of america\b/i, wellsfargo: /\bwells ?fargo\b/i, fedex: /\bfed ?ex\b/i, netflix: /\bnetflix\b/i,
};
const BRAND_LABELS: Record<Brand, string> = {
  paypal: "PayPal", usps: "USPS", irs: "the IRS", amazon: "Amazon", apple: "Apple", microsoft: "Microsoft", chase: "Chase",
  bankofamerica: "Bank of America", wellsfargo: "Wells Fargo", fedex: "FedEx", netflix: "Netflix",
};
export const ABUSED_TLDS = ["ru", "tk", "ml", "ga", "cf", "xyz", "top", "buzz"];
export const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc"];
const MULTI_PART_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp", "co.nz", "com.br", "co.in", "com.mx", "co.za"]);
const BARE_DOMAIN_TLDS = "com|net|org|gov|edu|us|uk|ca|ru|tk|ml|ga|cf|xyz|top|buzz|info|biz|co|io|ly|me|app|online|site|click|link|shop|live|support|help|cn|gl|at|cc|gd";
const MAX_LINKS = 25;
// Compared after deconfuse(), so "i" appears as "l".
const PHISHY_WORDS = /^(?:secure|securlty|securelogln|logln|slgnln|verlfy|verlficatlon|support|account|accounts|update|help|helpdesk|servlce|servlces|blllng|onllne|alert|alerts|team|ld|auth|track|tracklng|dellvery|refund|center|us|usa|check|confirm|access|web|malllng|notlce)$/;

export function registrableDomain(host: string) {
  const clean = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIpHost(clean)) return clean;
  const labels = clean.split(".");
  const take = labels.length >= 3 && MULTI_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-take).join(".");
}
function isIpHost(host: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":") || /^\[.*\]$/.test(host) || /^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host);
}
export function toUrl(raw: string): URL | null {
  const value = raw.trim().replace(/^<|>$/g, "");
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`);
    return url.hostname && ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch { return null; }
}
// Scammers swap look-alike characters: paypa1, rnicrosoft, amaz0n.
function deconfuse(text: string) {
  return text.toLowerCase().replace(/rn/g, "m").replace(/vv/g, "w").replace(/[0-9]/g, d => "olzeasbtbg"[Number(d)]).replace(/i/g, "l");
}
export function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}
function isOfficial(host: string, brand: Brand) {
  const domain = registrableDomain(host);
  return OFFICIAL[brand].some(official => domain === official || host === official || host.endsWith(`.${official}`));
}
function officialBrand(host: string) { return KNOWN_BRANDS.find(brand => isOfficial(host, brand)) || null; }
/** The brand a host imitates without being that brand's official domain. */
export function lookalikeBrand(host: string): Brand | null {
  if (isIpHost(host) || officialBrand(host)) return null;
  const tokens = host.toLowerCase().split(/[.\-_]+/).filter(Boolean);
  for (const brand of KNOWN_BRANDS) {
    const target = deconfuse(brand);
    // Short brands (irs, usps) only match exactly, so "ups.com" or "first.com" are never flagged.
    const allowed = brand.length >= 8 ? 2 : brand.length >= 6 ? 1 : 0;
    for (const token of tokens) {
      const plain = deconfuse(token);
      if (plain === target) return brand;
      // "paypalsecure", "applesupport" — but not unrelated words like "applebees".
      if (brand.length >= 4 && (plain.startsWith(target) || plain.endsWith(target)) && PHISHY_WORDS.test(plain.replace(target, ""))) return brand;
      if (allowed && token.length >= 4 && Math.abs(plain.length - target.length) <= allowed && editDistance(plain, target) <= allowed) return brand;
    }
  }
  return null;
}
function brandInText(text: string): Brand | null {
  return KNOWN_BRANDS.find(brand => BRAND_NAMES[brand].test(text)) || null;
}
function domainShownIn(display: string) {
  const match = display.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:[/:?#][^\s]*)?/i);
  return match ? toUrl(match[0])?.hostname.replace(/^www\./, "") || null : null;
}
const decodeEntities = (text: string) => text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const trimUrl = (url: string) => url.replace(/[.,;:!?'"\]]+$/, "").replace(/\)+$/, close => url.includes("(") ? close.slice(1) : "");

/** Every link in plain text, HTML anchors, Markdown links and "url (display text: …)" notes, with what it claims to be. */
export function extractLinks(input: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  let rest = input;
  const consume = (match: string) => { rest = rest.replace(match, " ".repeat(match.length)); };
  // 1. HTML anchors: the visible text versus the real destination is the classic trick.
  for (const match of input.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    links.push({ href: decodeEntities((match[1] ?? match[2] ?? match[3] ?? "").trim()), display_text: stripTags(match[4]) });
    consume(match[0]);
  }
  // Other HTML attributes that carry links (forms, images) are destinations too.
  for (const match of rest.matchAll(/\b(?:action|src)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^https?:/i.test(match[1])) links.push({ href: decodeEntities(match[1]), display_text: "" });
    consume(match[0]);
  }
  rest = rest.replace(/<[^>]*>/g, tag => " ".repeat(tag.length));
  // 2. Markdown [text](url).
  for (const match of rest.matchAll(/\[([^\]]{1,200})\]\((\S+?)\)/g)) { links.push({ display_text: match[1].trim(), href: match[2] }); consume(match[0]); }
  // 3. Pasted notes such as "https://evil.example/x (display text: www.paypal.com)".
  for (const match of rest.matchAll(/(\S+)\s*\((?:display(?:ed)? text|shows?|says?)\s*:\s*([^)]+)\)/gi)) {
    if (toUrl(trimUrl(match[1]))) { links.push({ href: trimUrl(match[1]), display_text: match[2].trim() }); consume(match[0]); }
  }
  // 4. Plain URLs, then bare domains such as "paypa1-secure.ru/verify". Email addresses are skipped.
  for (const match of rest.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi)) { const url = trimUrl(match[0]); links.push({ href: url, display_text: url }); consume(match[0]); }
  const bare = new RegExp(String.raw`(?<![@\w.\-/])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${BARE_DOMAIN_TLDS})(?![a-z0-9@-])(?:[/?#][^\s<>"'\x60]*)?`, "gi");
  for (const match of rest.matchAll(bare)) { const url = trimUrl(match[0]); links.push({ href: url, display_text: url }); }
  const seen = new Set<string>();
  return links.filter(link => link.href && !/^(?:mailto|tel|sms|javascript|data):/i.test(link.href) || /^(?:javascript|data):/i.test(link.href))
    .filter(link => { const key = `${link.href}\u0000${link.display_text}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, MAX_LINKS);
}

export function analyzeLink(link: ExtractedLink): LinkFinding {
  const flags: LinkFlag[] = [];
  const add = (code: string, severity: LinkFlag["severity"], message: string) => flags.push({ code, severity, message });
  if (/^(?:javascript|data):/i.test(link.href)) {
    add("script", "malicious", "This link runs hidden code instead of opening a website.");
    return { display_text: link.display_text, actual_url: link.href.slice(0, 300), actual_domain: "", shown_domain: null, verdict: "malicious", flags };
  }
  const url = toUrl(link.href);
  if (!url) {
    add("unreadable", "suspicious", "This link is broken or disguised, so we can't tell where it goes.");
    return { display_text: link.display_text, actual_url: link.href.slice(0, 300), actual_domain: "", shown_domain: null, verdict: "suspicious", flags };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const domain = registrableDomain(host);
  const shown = domainShownIn(link.display_text);
  if (url.username || url.password || /^[^/]*@/.test(link.href.replace(/^[a-z]+:\/\//i, "")))
    add("at-trick", "malicious", `The address uses an "@" trick: everything before the @ is a disguise, and it really goes to ${host}.`);
  if (host.split(".").some(label => label.startsWith("xn--")))
    add("punycode", "malicious", "The web address uses look-alike foreign letters to imitate a real site.");
  if (isIpHost(host)) add("ip-host", "suspicious", "This link goes to a bare number address instead of a company name. Real companies don't do that.");
  if (shown && registrableDomain(shown) !== domain)
    add("mismatch", "malicious", `The link says ${shown} but actually goes to ${host}.`);
  const lookalike = lookalikeBrand(host);
  if (lookalike) add("lookalike", "malicious", `${host} pretends to be ${BRAND_LABELS[lookalike]}, but it is not ${BRAND_LABELS[lookalike]}'s real website.`);
  const claimed = brandInText(link.display_text);
  if (claimed && !lookalike && !shown && !isOfficial(host, claimed))
    add("brand-text", "suspicious", `The link text mentions ${BRAND_LABELS[claimed]}, but it goes to ${host}.`);
  const tld = host.split(".").pop() || "";
  if (ABUSED_TLDS.includes(tld)) add("abused-tld", "suspicious", `The address ends in ".${tld}", an ending scammers use a lot.`);
  if (SHORTENERS.includes(domain) || SHORTENERS.includes(host))
    add("shortener", "suspicious", "This is a shortened link that hides where it really goes. Expand it with caution, or don't open it.");
  const subdomains = isIpHost(host) ? 0 : host.split(".").length - domain.split(".").length - (host.startsWith("www.") ? 1 : 0);
  if (subdomains >= 3) add("subdomains", "suspicious", `The address has many parts stacked together (${host}) to hide the real site, ${domain}.`);
  if (url.protocol === "http:" && /^https?:\/\//i.test(link.href)) add("no-https", "info", "This link is not secure (no https).");
  const rank = { info: 0, safe: 0, suspicious: 1, malicious: 2 } as const;
  const worst = flags.reduce((max, flag) => Math.max(max, rank[flag.severity]), 0);
  return {
    display_text: link.display_text, actual_url: url.href.slice(0, 500), actual_domain: host, shown_domain: shown,
    verdict: worst === 2 ? "malicious" : worst === 1 ? "suspicious" : "safe", flags,
  };
}

function header(text: string, name: string) {
  return text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "im"))?.[1].trim() || "";
}
function parseMailbox(value: string) {
  const angle = value.match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+@[^>\s]+)\s*>/);
  if (angle) return { name: angle[1].trim(), address: angle[2].toLowerCase() };
  const bare = value.match(/[^\s<>"]+@[^\s<>"]+/);
  return { name: bare ? value.replace(bare[0], "").replace(/[<>()"]/g, "").trim() : value, address: bare ? bare[0].toLowerCase().replace(/[.,;]+$/, "") : "" };
}
/** Sender facts from the From and Reply-To lines, when the pasted email includes them. */
export function checkSender(text: string): SenderFacts | null {
  const from = header(text, "From");
  if (!from) return null;
  const { name, address } = parseMailbox(from);
  const replyTo = parseMailbox(header(text, "Reply-To")).address;
  const reasons: string[] = [];
  const domain = address.split("@")[1] || "";
  const claimed = brandInText(name) || (domain ? lookalikeBrand(domain) : null);
  let spoofed = false;
  if (claimed && domain && !isOfficial(domain, claimed)) {
    spoofed = true; reasons.push(`It claims to be ${BRAND_LABELS[claimed]}, but it was sent from ${domain}, which is not ${BRAND_LABELS[claimed]}.`);
  }
  if (domain && ABUSED_TLDS.includes(domain.split(".").pop() || "")) reasons.push(`The sender's address ends in ".${domain.split(".").pop()}", an ending scammers use a lot.`);
  if (replyTo && replyTo !== address && registrableDomain(replyTo.split("@")[1] || "") !== registrableDomain(domain)) {
    spoofed = true; reasons.push(`Replies would go to a different address (${replyTo}) than the sender.`);
  }
  return { display_name: name, address, reply_to: replyTo, claimed_brand: claimed ? BRAND_LABELS[claimed] : null, spoofed, reasons };
}
export function linkReport(text: string) {
  return { links: extractLinks(text).map(analyzeLink), sender: checkSender(text) };
}
