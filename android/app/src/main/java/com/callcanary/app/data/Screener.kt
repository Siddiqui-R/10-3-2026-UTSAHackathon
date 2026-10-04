package com.callcanary.app.data

/** What CallCanary does with an incoming call. Pure logic, so it can be unit-tested. */
sealed class Decision {
    data class Allow(val note: String) : Decision()
    data class Block(val reason: String) : Decision()
}

object Screener {
    /**
     * Decide within Android's 5-second screening window.
     * Order: your block list, then the FTC reported list. Unknown/hidden numbers are allowed unless you choose otherwise.
     */
    fun decide(
        number: String?,
        blocked: Set<String>,
        report: ReportedNumbers.Report?,
        blockReported: Boolean,
        blockHidden: Boolean,
    ): Decision = when {
        number == null && blockHidden -> Decision.Block("Hidden or unknown number")
        number == null -> Decision.Allow("Hidden number, allowed")
        number in blocked -> Decision.Block("On your block list")
        report != null && blockReported -> Decision.Block(
            "Reported to the FTC ${report.reports} ${if (report.reports == 1) "time" else "times"} (${report.topic})"
        )
        report != null -> Decision.Allow("Reported to the FTC ${report.reports} times, allowed by your settings")
        else -> Decision.Allow("Not on any scam list")
    }
}
