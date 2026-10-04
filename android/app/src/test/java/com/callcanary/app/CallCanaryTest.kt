package com.callcanary.app

import com.callcanary.app.data.CheckApi
import com.callcanary.app.data.Decision
import com.callcanary.app.data.LinkCheck
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ReportedNumbers
import com.callcanary.app.data.ScamSignals
import com.callcanary.app.data.Screener
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class CallCanaryTest {
    @Test fun normalizesUsNumbers() {
        assertEquals("2105550100", PhoneNumbers.normalizeUs("(210) 555-0100"))
        assertEquals("2105550100", PhoneNumbers.normalizeUs("+1 210 555 0100"))
        assertEquals("2105550100", PhoneNumbers.normalizeUs("tel:+12105550100"))
        assertNull(PhoneNumbers.normalizeUs("555-0100"))
        assertNull(PhoneNumbers.normalizeUs("0105550100"))
        assertNull(PhoneNumbers.normalizeUs(null))
        assertEquals("(210) 555-0100", PhoneNumbers.format("2105550100"))
    }

    private val report = ReportedNumbers.Report("2012663840", 5, 5, "2026-09-17", "Dropped call or no message")

    @Test fun screeningDecisionOrder() {
        // Your block list first, then FTC reports; hidden numbers only when you choose.
        assertTrue(Screener.decide("4155550142", setOf("4155550142"), null, blockReported = true, blockHidden = false) is Decision.Block)
        val ftc = Screener.decide("2012663840", emptySet(), report, blockReported = true, blockHidden = false)
        assertTrue(ftc is Decision.Block); assertTrue((ftc as Decision.Block).reason.contains("5 times"))
        assertTrue(Screener.decide("2012663840", emptySet(), report, blockReported = false, blockHidden = false) is Decision.Allow)
        assertTrue(Screener.decide("4155550142", emptySet(), null, blockReported = true, blockHidden = false) is Decision.Allow)
        assertTrue(Screener.decide(null, emptySet(), null, blockReported = true, blockHidden = false) is Decision.Allow)
        assertTrue(Screener.decide(null, emptySet(), null, blockReported = true, blockHidden = true) is Decision.Block)
    }

    @Test fun loadsTheSharedFtcList() {
        // The same file the website ships (repo data/ folder). Unit tests run from the app module directory.
        val list = File("../../data/ftc-reported-numbers.tsv.gz").inputStream().use { ReportedNumbers.parse(it) }
        assertTrue(list.size > 100_000)
        val hit = list.lookup("2012663840")
        assertNotNull("the demo robocall number should be reported", hit)
        assertEquals(5, hit!!.reports)
        assertNull(list.lookup("4155550142"))
        assertNull(list.lookup(null))
    }

    @Test fun loadsTheUnpackedListTheApkShips() {
        // The Android build unpacks .gz assets, so the app reads plain text on a device. Both forms must parse.
        val plain = java.util.zip.GZIPInputStream(File("../../data/ftc-reported-numbers.tsv.gz").inputStream()).readBytes()
        val list = ReportedNumbers.parse(plain.inputStream())
        assertEquals(5, list.lookup("2012663840")!!.reports)
    }

    @Test fun parsesCheckerResults() {
        val json = JSONObject("""{"level":"phishing","risk_score":98,"recommended_action":"Delete it.","ai_checked":true,
            "typos":[{"typo":"activty","correction":"activity"}],
            "links":[{"display_text":"www.paypal.com/signin","shown_domain":"paypal.com","actual_domain":"paypa1-secure.ru","actual_url":"https://paypa1-secure.ru/verify","verdict":"malicious","explanation":"Fake PayPal."}],
            "sender":{"display_name":"PayPal Support","address":"support@paypa1-secure.ru","claimed_brand":"PayPal","spoofed":true,"explanation":"Not PayPal."},
            "pressure_tactics":["24-hour deadline"]}""")
        val r = CheckApi.parse(json)
        assertEquals("phishing", r.level); assertEquals(98, r.riskScore)
        assertEquals("paypal.com", r.links[0].shown); assertEquals("paypa1-secure.ru", r.links[0].actualDomain)
        assertEquals("activity", r.typos[0].correction); assertTrue(r.sender!!.spoofed)
        // A link with no domain in its text falls back to the text itself.
        val bare = CheckApi.parse(JSONObject("""{"level":"suspicious","links":[{"display_text":"bit.ly/abc","shown_domain":null,"actual_domain":"bit.ly","verdict":"suspicious"}]}"""))
        assertEquals("bit.ly/abc", bare.links[0].shown)
    }

    @Test fun scoresScamSpeechLikeTheWebsite() {
        val scam = ScamSignals.score("This is the fraud department from your bank. Read me the code we just texted you, and don't tell anyone. You must pay today with gift cards.")
        assertTrue(scam.score >= ScamSignals.THRESHOLD)
        val ids = scam.signals.map { it.id }
        assertTrue("code" in ids); assertTrue("secrecy" in ids); assertTrue("gift" in ids)
        // An ordinary call stays quiet.
        assertEquals(0, ScamSignals.score("Hi grandma, just calling to say we'll be there Sunday for lunch.").score)
        // Talking about scams is not being scammed.
        val advice = ScamSignals.score("The news said scammers will ask you to buy gift cards. If anyone asks you to, hang up.")
        assertTrue(advice.score < ScamSignals.THRESHOLD)
        // Negated: "I will never ask for your password".
        assertTrue(ScamSignals.score("we will never ask you to give us your password").score < ScamSignals.THRESHOLD)
        assertEquals(100, ScamSignals.score("warrant arrest gift card numbers wire transfer bitcoin atm anydesk read me the code").score)
    }

    @Test fun checksLinksInMessagesLikeTheWebsite() {
        assertEquals("microsoft", LinkCheck.lookalikeBrand("rnicrosoft.com"))
        assertEquals("paypal", LinkCheck.lookalikeBrand("paypa1-secure.ru"))
        assertNull(LinkCheck.lookalikeBrand("microsoft.com"))
        assertNull(LinkCheck.lookalikeBrand("applebees.com"))
        assertNull(LinkCheck.lookalikeBrand("ups.com"))
        assertEquals(setOf("usps-track.xyz/pay", "https://bit.ly/3abc"), LinkCheck.extract("Pay at usps-track.xyz/pay. Or https://bit.ly/3abc, thanks").toSet())
        assertEquals("malicious", LinkCheck.analyze("https://paypal.com@evil.example/login").verdict)
        assertEquals("suspicious", LinkCheck.analyze("http://192.168.4.20/login").verdict)
        assertEquals("safe", LinkCheck.analyze("https://www.chase.com/personal").verdict)

        val scam = LinkCheck.message("Chase alert: your account is locked. Verify at chase-secure-login.top/verify")
        assertEquals("scam", scam.level); assertTrue(scam.reasons.first().contains("pretends to be Chase"))
        assertEquals("scam", LinkCheck.message("IRS notice: pay with gift cards today or a warrant will be issued").level)
        assertEquals("safe", LinkCheck.message("Hey it's Sam, dinner at 7? Here's the place: www.yelp.com/biz/la-gloria").level)
        assertEquals("suspicious", LinkCheck.message("Your order shipped: https://tinyurl.com/abc123").level)
    }
}
