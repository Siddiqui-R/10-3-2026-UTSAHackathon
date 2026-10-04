package com.callcanary.app.data

import java.net.URI

/**
 * The website's deterministic link checks (lib/linkCheck.ts), ported for plain text such as texts and notification
 * previews: look-alike brands (rnicrosoft, paypa1), "@" tricks, punycode, bare IPs, scam endings, shorteners and
 * stacked subdomains. Instant and offline; the full check with the AI still runs on the website.
 */
object LinkCheck {
    data class Finding(val url: String, val host: String, val verdict: String, val reasons: List<String>)

    private val OFFICIAL = mapOf(
        "paypal" to listOf("paypal.com", "paypal.me", "paypalobjects.com"), "usps" to listOf("usps.com", "usps.gov"), "irs" to listOf("irs.gov"),
        "amazon" to listOf("amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazonaws.com", "amazon.jobs", "a.co"),
        "apple" to listOf("apple.com", "icloud.com", "me.com", "apple.news"),
        "microsoft" to listOf("microsoft.com", "live.com", "outlook.com", "office.com", "microsoftonline.com", "office365.com", "xbox.com"),
        "chase" to listOf("chase.com", "jpmorganchase.com", "jpmorgan.com"), "bankofamerica" to listOf("bankofamerica.com", "bofa.com", "ml.com"),
        "wellsfargo" to listOf("wellsfargo.com", "wf.com"), "fedex" to listOf("fedex.com"), "netflix" to listOf("netflix.com", "nflxext.com"),
    )
    private val LABELS = mapOf("paypal" to "PayPal", "usps" to "USPS", "irs" to "the IRS", "amazon" to "Amazon", "apple" to "Apple", "microsoft" to "Microsoft",
        "chase" to "Chase", "bankofamerica" to "Bank of America", "wellsfargo" to "Wells Fargo", "fedex" to "FedEx", "netflix" to "Netflix")
    private val ABUSED_TLDS = setOf("ru", "tk", "ml", "ga", "cf", "xyz", "top", "buzz")
    private val SHORTENERS = setOf("bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc")
    private val MULTI_PART = setOf("co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp", "co.nz", "com.br", "co.in", "com.mx", "co.za")
    private const val BARE_TLDS = "com|net|org|gov|edu|us|uk|ca|ru|tk|ml|ga|cf|xyz|top|buzz|info|biz|co|io|ly|me|app|online|site|click|link|shop|live|support|help|cn|gl|at|cc|gd"
    // Compared after deconfuse(), so "i" appears as "l".
    private val PHISHY = Regex("^(?:secure|securlty|securelogln|logln|slgnln|verlfy|verlficatlon|support|account|accounts|update|help|helpdesk|servlce|servlces|blllng|onllne|alert|alerts|team|ld|auth|track|tracklng|dellvery|refund|center|us|usa|check|confirm|access|web|malllng|notlce)$")
    private val URL_RE = Regex("""\b(?:https?://|www\.)[^\s<>"'`]+""", RegexOption.IGNORE_CASE)
    private val BARE_RE = Regex("""(?<![@\w.\-/])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:$BARE_TLDS)(?![a-z0-9@-])(?:[/?#][^\s<>"'`]*)?""", RegexOption.IGNORE_CASE)

    fun extract(text: String): List<String> {
        var rest = text
        val found = mutableListOf<String>()
        URL_RE.findAll(text).forEach { found += trim(it.value); rest = rest.replace(it.value, " ".repeat(it.value.length)) }
        BARE_RE.findAll(rest).forEach { found += trim(it.value) }
        return found.distinct().take(25)
    }
    private fun trim(url: String) = url.trimEnd('.', ',', ';', ':', '!', '?', '\'', '"', ']', ')')

    fun registrableDomain(host: String): String {
        if (isIp(host)) return host
        val labels = host.lowercase().trimEnd('.').split(".")
        val take = if (labels.size >= 3 && labels.takeLast(2).joinToString(".") in MULTI_PART) 3 else 2
        return labels.takeLast(take).joinToString(".")
    }
    private fun isIp(host: String) = Regex("""^\d{1,3}(?:\.\d{1,3}){3}$""").matches(host) || host.contains(':') || Regex("""^\d+$""").matches(host)
    private fun deconfuse(s: String) = s.lowercase().replace("rn", "m").replace("vv", "w").map { c -> if (c.isDigit()) "olzeasbtbg"[c - '0'] else c }.joinToString("").replace('i', 'l')
    private fun isOfficial(host: String, brand: String) = OFFICIAL.getValue(brand).any { registrableDomain(host) == it || host == it || host.endsWith(".$it") }

    fun editDistance(a: String, b: String): Int {
        val row = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            var previous = row[0]; row[0] = i
            for (j in 1..b.length) { val current = row[j]; row[j] = minOf(row[j] + 1, row[j - 1] + 1, previous + if (a[i - 1] == b[j - 1]) 0 else 1); previous = current }
        }
        return row[b.length]
    }

    /** The brand a host imitates without being that brand's official domain. */
    fun lookalikeBrand(host: String): String? {
        if (isIp(host) || OFFICIAL.keys.any { isOfficial(host, it) }) return null
        val tokens = host.lowercase().split(Regex("[.\\-_]+")).filter { it.isNotEmpty() }
        for (brand in OFFICIAL.keys) {
            val target = deconfuse(brand)
            // Short brands (irs, usps) only match exactly, so "ups.com" or "first.com" are never flagged.
            val allowed = if (brand.length >= 8) 2 else if (brand.length >= 6) 1 else 0
            for (token in tokens) {
                val plain = deconfuse(token)
                if (plain == target) return brand
                if (brand.length >= 4 && (plain.startsWith(target) || plain.endsWith(target)) && PHISHY.matches(plain.replaceFirst(target, ""))) return brand
                if (allowed > 0 && token.length >= 4 && kotlin.math.abs(plain.length - target.length) <= allowed && editDistance(plain, target) <= allowed) return brand
            }
        }
        return null
    }

    fun analyze(raw: String): Finding {
        val reasons = mutableListOf<String>()
        var worst = 0
        fun add(severity: Int, reason: String) { reasons += reason; worst = maxOf(worst, severity) }
        val uri = runCatching { URI(if (Regex("^[a-z][a-z0-9+.-]*://", RegexOption.IGNORE_CASE).containsMatchIn(raw)) raw else "http://$raw") }.getOrNull()
        val host = uri?.host?.lowercase()?.removePrefix("[")?.removeSuffix("]")
        if (host.isNullOrEmpty()) return Finding(raw, "", "suspicious", listOf("This link is broken or disguised, so we can't tell where it goes."))
        val domain = registrableDomain(host)
        if (uri.userInfo != null) add(2, "The address uses an \"@\" trick: it really goes to $host.")
        if (host.split(".").any { it.startsWith("xn--") }) add(2, "The web address uses look-alike foreign letters to imitate a real site.")
        if (isIp(host)) add(1, "This link goes to a bare number address instead of a company name.")
        lookalikeBrand(host)?.let { b -> add(2, "$host pretends to be ${LABELS[b]}, but it is not ${LABELS[b]}'s real website.") }
        val tld = host.substringAfterLast('.')
        if (tld in ABUSED_TLDS) add(1, "The address ends in \".$tld\", an ending scammers use a lot.")
        if (domain in SHORTENERS || host in SHORTENERS) add(1, "This is a shortened link that hides where it really goes.")
        val subdomains = if (isIp(host)) 0 else host.split(".").size - domain.split(".").size - if (host.startsWith("www.")) 1 else 0
        if (subdomains >= 3) add(1, "The address has many parts stacked together ($host) to hide the real site, $domain.")
        return Finding(raw, host, when (worst) { 2 -> "malicious"; 1 -> "suspicious"; else -> "safe" }, reasons)
    }

    /** A quick verdict for a message: its links plus the scam phrases in its words. */
    data class MessageVerdict(val level: String, val reasons: List<String>, val links: List<Finding>, val score: Int)

    fun message(text: String): MessageVerdict {
        val links = extract(text).map(::analyze)
        val words = ScamSignals.score(text)
        val tricks = words.signals.filter { it.note == null && it.id != "combo" }.map { it.label.lowercase() }
        val reasons = links.filter { it.verdict != "safe" }.flatMap { it.reasons }.distinct() +
            listOfNotNull(tricks.takeIf { it.isNotEmpty() }?.let { "It uses scam tricks: ${it.joinToString(", ")}." })
        val level = when {
            links.any { it.verdict == "malicious" } || words.score >= ScamSignals.THRESHOLD -> "scam"
            links.any { it.verdict == "suspicious" } || words.score >= 15 -> "suspicious"
            else -> "safe"
        }
        return MessageVerdict(level, reasons, links, words.score)
    }
}
