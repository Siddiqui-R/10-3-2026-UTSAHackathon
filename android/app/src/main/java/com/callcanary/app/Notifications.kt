package com.callcanary.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.callcanary.app.listen.ListenActivity

object Notifications {
    private const val CHANNEL = "blocked_calls"
    /** The ongoing "protecting this call" notification while listening. */
    const val LIVE = "live_call"
    /** Scam warnings during a call, and the offer to protect an incoming call. Loud on purpose. */
    private const val ALERTS = "scam_alerts"

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL) == null)
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "Blocked calls", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Tells you when CallCanary blocks or silences a scam call."
            })
        if (manager.getNotificationChannel(LIVE) == null)
            manager.createNotificationChannel(NotificationChannel(LIVE, "Call protection", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shows while CallCanary is listening to a call on speaker."
            })
        if (manager.getNotificationChannel(ALERTS) == null)
            manager.createNotificationChannel(NotificationChannel(ALERTS, "Scam warnings", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Warns you during a call when the caller uses scam tricks."
            })
    }

    private fun allowed(context: Context) =
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun blockedCall(context: Context, number: String, reason: String, silenced: Boolean) {
        if (!allowed(context)) return
        ensureChannel(context)
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle(if (silenced) "Silenced a scam call from $number" else "Blocked a scam call from $number")
            .setContentText(reason)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reason))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(number.hashCode(), notification) }
    }

    /** An unknown number is calling: one tap opens CallCanary ready to listen once the call is answered on speaker. */
    fun offerProtection(context: Context, number: String?, note: String) {
        if (!allowed(context)) return
        ensureChannel(context)
        val open = PendingIntent.getActivity(context, 3, ListenActivity.intent(context, number, autoStart = true), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(context, ALERTS)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle("Unknown caller${number?.let { ": $it" } ?: ""}")
            .setContentText("Answer on speaker, then tap here so CallCanary listens for scam tricks.")
            .setStyle(NotificationCompat.BigTextStyle().bigText("$note\nAnswer on speaker, then tap here so CallCanary listens for scam tricks."))
            .setContentIntent(open)
            .addAction(0, "Protect this call", open)
            .setAutoCancel(true)
            .setTimeoutAfter(120_000)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(OFFER_ID, notification) }
    }

    fun scamAlert(context: Context, number: String?, reasons: String) {
        if (!allowed(context)) return
        ensureChannel(context)
        val open = PendingIntent.getActivity(context, 4, ListenActivity.intent(context, null, autoStart = false), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val text = "The caller${number?.let { " ($it)" } ?: ""} is using scam tricks: $reasons. Don't send money or read any codes."
        val notification = NotificationCompat.Builder(context, ALERTS)
            .setSmallIcon(R.drawable.ic_shield)
            .setContentTitle("This sounds like a SCAM. Hang up.")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(ALERT_ID, notification) }
    }

    /** A text or email that looks like a scam; "See why" opens the full check with the message filled in. */
    fun scamMessage(context: Context, app: String, from: String, text: String, scam: Boolean, summary: String) {
        if (!allowed(context)) return
        ensureChannel(context)
        val check = Intent(context, CheckActivity::class.java).setAction(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, text).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val open = PendingIntent.getActivity(context, text.hashCode(), check, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val title = if (scam) "Scam warning in $app: $from" else "Be careful, $app: $from"
        val body = "$summary Don't tap its links or reply."
        val notification = NotificationCompat.Builder(context, ALERTS)
            .setSmallIcon(R.drawable.ic_shield).setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open).addAction(0, "See why", open).setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(text.hashCode(), notification) }
    }

    private const val OFFER_ID = 7002
    private const val ALERT_ID = 7003
}
