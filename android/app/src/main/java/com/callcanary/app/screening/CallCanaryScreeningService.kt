package com.callcanary.app.screening

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import com.callcanary.app.Notifications
import com.callcanary.app.data.Decision
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ReportedNumbers
import com.callcanary.app.data.Screener
import com.callcanary.app.data.Store

/**
 * Android hands CallCanary every incoming call from a number that isn't in your contacts, once CallCanary holds the
 * call screening role. It must answer within 5 seconds; the checks here are local (block list + bundled FTC list).
 */
class CallCanaryScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        if (details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, CallResponse.Builder().build()); return
        }
        val store = Store(this)
        val number = PhoneNumbers.normalizeUs(details.handle?.schemeSpecificPart)
        // A broken list must never block (or let through by mistake) more than it should: fall back to the block list only.
        val report = runCatching { ReportedNumbers.get(this).lookup(number) }
            .onFailure { Log.e(TAG, "FTC list unavailable; screening with your block list only", it) }.getOrNull()
        val decision = Screener.decide(number, store.blockedSet(), report, store.blockReported, store.blockHidden)
        val shown = number?.let { PhoneNumbers.format(it) } ?: "Hidden number"
        val response = CallResponse.Builder()
        when (decision) {
            is Decision.Block -> {
                if (store.silenceOnly) response.setSilenceCall(true)
                else response.setDisallowCall(true).setRejectCall(true).setSkipNotification(true)
                store.addEvent("call", "${if (store.silenceOnly) "Silenced" else "Blocked"} a call from $shown", decision.reason, blocked = true)
                Notifications.blockedCall(this, shown, decision.reason, silenced = store.silenceOnly)
            }
            is Decision.Allow -> {
                store.addEvent("call", "Call from $shown", decision.note, blocked = false)
                // Not on any list, but still a stranger: offer to listen in case it turns into a scam.
                if (store.offerListening) Notifications.offerProtection(this, number?.let { PhoneNumbers.format(it) }, decision.note)
            }
        }
        Log.i(TAG, "screened $shown -> $decision")
        respondToCall(details, response.build())
    }

    companion object { const val TAG = "CallCanary" }
}
