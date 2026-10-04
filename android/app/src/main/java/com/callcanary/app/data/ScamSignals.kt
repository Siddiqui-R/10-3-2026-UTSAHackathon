package com.callcanary.app.data

/**
 * The website's phrase scorer (lib/scamSignals.ts), ported so the phone can score live call speech offline.
 * These are investigation triggers, not fraud verdicts. Each rule counts once, so repeating a phrase can't inflate
 * the score; negated or discussion-context phrases still show but carry reduced weight.
 */
object ScamSignals {
    data class Signal(val id: String, val label: String, val phrase: String, val weight: Int, val note: String? = null)
    data class Result(val score: Int, val signals: List<Signal>)

    private class Rule(val id: String, val label: String, val weight: Int, val group: String?, vararg patterns: String) {
        val regexes = patterns.map { Regex(it) }
    }

    const val THRESHOLD = 35
    private const val GIFT_CARD = """(?:gift ?cards?|itunes cards?|google play cards?|prepaid cards?|steam cards?)"""

    private val rules = listOf(
        Rule("gift", "Gift-card payment", 35, "payment",
            """\bpay(?:ing|ment)? (?:\w+ ){0,4}(?:with|in|using|by|through) (?:\w+ ){0,2}$GIFT_CARD""",
            """\b(?:buy|purchase|get|pick up) (?:\w+ ){0,4}$GIFT_CARD (?:\w+ ){0,6}(?:and|then) (?:read|give|send|call|scratch|text|take a picture)""",
            """\bgo to (?:the )?(?:walmart|target|cvs|walgreens|store|kroger|heb|best buy|dollar general) (?:and )?(?:buy|get|purchase) (?:\w+ ){0,4}(?:cards?|$GIFT_CARD)""",
            """$GIFT_CARD (?:\w+ ){0,3}(?:numbers?|codes?|pins?|back of)""",
            """\b(?:scratch (?:off )?the (?:back|silver)|read me the (?:numbers|codes?) on the (?:back|card))"""),
        Rule("gift-mention", "Gift cards mentioned", 15, null, """\b(?:gift ?cards?|itunes cards?|google play cards?|prepaid cards?)\b"""),
        Rule("wire", "Money transfer request", 25, "payment",
            """\bwire (?:me |us |him |her )?(?:the |your |that |this )?(?:money|funds|\w+ (?:thousand|hundred)|transfer|it)\b""", """\bwire transfer\b""",
            """\bsend (?:me |us |him |her )?(?:the )?(?:money|cash|funds|\w+ (?:thousand|hundred) dollars)\b""",
            """\b(?:western union|moneygram|money gram)\b""",
            """\b(?:transfer|move) (?:the |your |all (?:of )?(?:the |your )?)?(?:money|savings|funds)\b""",
            """\b(?:zelle|cash ?app|venmo) (?:me|it|the money|us)\b"""),
        Rule("cash", "Cash pickup or courier", 35, "payment",
            """\b(?:courier|driver|someone) (?:will|is going to|can) (?:come|stop by) (?:and )?(?:pick up|collect|get) (?:the )?(?:cash|money|package)""",
            """\b(?:put|mail|hide) (?:the )?cash (?:in|inside) (?:a |an )?(?:box|envelope|book|magazine)"""),
        Rule("crypto", "Crypto payment", 35, "payment",
            """\b(?:bitcoin|btc|crypto(?: ?currency)?) (?:atm|machine|kiosk|wallet address)\b""",
            """\b(?:pay|send|deposit|put|convert|buy|move) (?:\w+ ){0,5}(?:in(?:to)? |as |with |using )?(?:bitcoin|crypto(?: ?currency)?|usdt|tether)\b"""),
        Rule("crypto-mention", "Cryptocurrency mentioned", 15, null, """\b(?:bitcoin|crypto(?: ?currency)?|usdt|tether)\b"""),
        Rule("threat", "Threat of arrest or legal trouble", 30, "pressure",
            """\bwarrant\b""", """\b(?:arrest(?:ed)?|go to jail|be jailed|police (?:will|are going to) come|deport(?:ed|ation)?|lawsuit (?:against|filed))\b""",
            """\b(?:social security number|ssn) (?:has been |is |was )?(?:suspended|frozen|compromised|blocked)\b"""),
        Rule("authority", "Claims to be an official", 10, null,
            """\b(?:irs|internal revenue service|federal (?:matter|agent|agency)|social security administration|medicare (?:office|department)|sheriff'?s? (?:office|department)|u ?s ?marshal|fbi|dea|customs (?:and border|office))\b"""),
        Rule("tech-brand", "Unexpected tech support", 15, null,
            """\b(?:microsoft|apple|windows|amazon|geek squad) (?:support|security|technician|department|refund)\b""",
            """\byour (?:computer|device|account|phone) (?:has been |is |was )?(?:hacked|infected|compromised|has a virus)\b"""),
        Rule("secrecy", "Keep it secret", 25, null,
            """\b(?:do not|don'?t|dont|never) (?:tell|mention (?:this|it) to|talk to) (?:anyone|anybody|your (?:kids|children|family|son|daughter|husband|wife|bank|teller)|mom|dad|the bank)\b(?! (?:your|the) (?:pin|password|code|social|account|card))""",
            """\bkeep (?:this|it) (?:a )?(?:secret|between us|quiet|confidential)\b""",
            """\b(?:do not|don'?t|dont) call (?:the bank|your bank|anyone|your family|your kids)(?: yourself)?\b""",
            """\b(?:if the bank|if the teller|if anyone) asks?,? (?:say|tell them)\b"""),
        Rule("urgent", "Pressure to act now", 15, "pressure",
            """\b(?:pay (?:it )?(?:immediately|right now|today)|time is running out|act (?:now|fast|immediately)|right away or|within the (?:next )?(?:hour|\w+ minutes)|must pay|today only|last chance|before it'?s too late)\b""",
            """\b(?:do not|don'?t|dont) hang up\b""", """\bstay on the (?:line|phone)\b"""),
        Rule("code", "Asks for codes, passwords or ID numbers", 35, null,
            """\b(?:tell|give|read|send|share|confirm|verify|provide) (?:me |us )?(?:back )?(?:your |the |that )?(?:\w+ )?(?:password|pin(?: number)?|verification code|security code|confirmation code|one[- ]?time (?:code|passcode|password)|code (?:we|i) (?:just )?(?:sent|texted))\b""",
            """\b(?:what is|what'?s) your (?:social security number|ssn|bank account number|account number|routing number|card number|pin|password)\b""",
            """\b(?:need|confirm|verify|read me) (?:your |the )?(?:full )?(?:social security number|bank account number|card number|medicare number)\b""",
            """\b(?:read|tell|give|send) (?:me|us) (?:the|that|this) (?:\w+ )?code\b"""),
        Rule("bank", "Claims to be your bank", 15, null,
            """\b(?:fraud|security) (?:department|team|prevention|center) (?:at|of|from) (?:your|the) bank\b""",
            """\b(?:calling|this is \w+) from your bank\b""", """\bsuspicious (?:charge|transaction|purchase|withdrawal)s?\b"""),
        Rule("remote", "Remote access to a device", 35, null,
            """\b(?:anydesk|any desk|teamviewer|team viewer|ultraviewer|logmein|screen ?connect|remote access|remote desktop|quick ?assist)\b""",
            """\b(?:download|install) (?:this |the |an |a )?(?:app|software|program|application) (?:so (?:i|we) can|to (?:fix|remove|secure))\b"""),
        Rule("relative", "Family emergency money story", 25, null,
            """\b(?:grandma|grandpa|nana|grandmother|grandfather),? (?:it'?s me|i'?m in (?:trouble|jail))""",
            """\b(?:need|send|pay) (?:\w+ )?(?:bail|bail money|lawyer'?s? fees?|hospital bill)\b""", """\bi'?m in jail\b"""),
        Rule("romance", "Overseas money story", 15, null,
            """\b(?:bank froze my account|fly home to you|stranded (?:overseas|abroad)|stuck (?:overseas|abroad)|account (?:is |was |has been )?frozen|customs (?:fee|is holding)|oil rig)\b"""),
        Rule("package", "Unexpected delivery fee", 35, null,
            """\b(?:redelivery fee|package (?:could not|couldn'?t|cannot) be delivered|usps[- ]?track|update your (?:address|delivery) (?:and|to) pay)\b"""),
        Rule("prize", "Pay to claim a prize or refund", 35, "payment",
            """\b(?:pay|send) (?:a |the |\w+ )?(?:fee|taxes?|processing (?:fee|charge)) (?:to|so you can|before you can) (?:claim|collect|receive|release)\b""",
            """\byou(?:'ve| have)? (?:won|been selected for) (?:the |a |our )?(?:lottery|sweepstakes|prize|grand prize|jackpot|cash prize)\b""",
            """\b(?:refund|overpaid you|sent you too much)\b.{0,60}\b(?:send|pay|give) (?:it |the difference |us )?back\b"""),
    )

    // Reassurance ("don't worry, just pay…") is a pressure tactic, not a negation of what follows.
    private val REASSURANCE = Regex("""\b(?:don'?t|do not|dont) (?:worry|panic|be scared|be afraid)\b|\bno (?:problem|worries)\b|\bnot a problem\b""")
    private val NEGATORS = Regex("""\b(?:not|never|don'?t|dont|doesn'?t|won'?t|will not|wouldn'?t|can'?t|cannot|isn'?t|aren'?t|nobody|no one|refuse|refused|didn'?t)\b""")
    // Reported speech ("they'll say", "if someone asks you to") marks advice even when the quoted words are a direct demand.
    private val REPORTED = Regex("""\b(?:they(?:'ll| will| might| may| would)? (?:say|ask|tell you)|will say|might say|would say|asks? you to|if (?:someone|anyone|a caller|they) (?:asks?|tells?|says?))\b""")
    // Talking *about* scams (news, warnings, family advice) rather than being targeted by one.
    private val DISCUSSION = Regex("""\b(?:scams?|scammers?|scammed|con artists?|fraudsters?|hoax|on the news|news (?:said|story|report)|article|read about|heard about|warned (?:me|us|you)|warning about|watch out for|be careful (?:of|about|with)|they (?:tried|try) to|tried to trick|trying to trick|fake call|fake caller|pretend(?:ed|ing)? to be|pretend|the bank will never|will never (?:call|ask)|never ask(?:s)? for)\b""")
    private val DIRECT_TARGET = Regex("""\b(?:me|us)\b""")
    private val YOU_MUST = Regex("""\byou (?:need|must|have) to\b""")

    fun normalize(text: String) = text.lowercase().replace(Regex("[’‘`]"), "'").replace(Regex("[^a-z0-9'$ ]+"), " ").replace(Regex("\\s+"), " ").trim()

    private fun contextBefore(text: String, index: Int, words: Int) = text.substring(0, index).split(" ").takeLast(words).joinToString(" ")

    fun score(text: String): Result {
        val normalized = normalize(text)
        val signals = mutableListOf<Signal>()
        val groups = mutableSetOf<String>()
        for (rule in rules) {
            if (rule.id.endsWith("-mention") && signals.any { it.id == rule.id.removeSuffix("-mention") }) continue
            var best: Signal? = null
            for (regex in rule.regexes) for (match in regex.findAll(normalized)) {
                val index = match.range.first
                val near = REASSURANCE.replace(contextBefore(normalized, index, 5), " ")
                val sentence = normalized.substring(maxOf(0, index - 90), minOf(normalized.length, match.range.last + 1 + 60))
                var weight = rule.weight; var note: String? = null
                // A negator inside the match ("don't tell anyone") is the warning itself; only words before it negate it.
                val direct = DIRECT_TARGET.containsMatchIn(match.value) || YOU_MUST.containsMatchIn(near)
                val reported = REPORTED.containsMatchIn(contextBefore(normalized, index, 8))
                if (NEGATORS.containsMatchIn(near)) { weight = Math.round(weight * 0.2f); note = "negated" }
                else if (reported || (!direct && DISCUSSION.containsMatchIn(sentence))) { weight = Math.round(weight * 0.35f); note = "discussion" }
                if (best == null || weight > best.weight) best = Signal(rule.id, rule.label, match.value.trim(), weight, note)
            }
            best?.let { signals += it; if (rule.group != null && it.note == null) groups += rule.group }
        }
        // Classic scam structure: a payment demand combined with pressure or a threat.
        if ("payment" in groups && "pressure" in groups) signals += Signal("combo", "Payment demand plus pressure", "payment + pressure", 10)
        return Result(minOf(100, signals.sumOf { it.weight }), signals)
    }
}
