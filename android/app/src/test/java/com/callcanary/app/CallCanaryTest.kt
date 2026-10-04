package com.callcanary.app

import com.callcanary.app.data.CheckApi
import com.callcanary.app.data.Decision
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ReportedNumbers
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
}
