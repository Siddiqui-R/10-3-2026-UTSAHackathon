package com.callcanary.app.messages

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import androidx.core.app.NotificationCompat
import com.callcanary.app.Notifications
import com.callcanary.app.data.LinkCheck
import com.callcanary.app.data.Store

/**
 * Checks new texts and emails the moment they arrive, using the preview in their notification (Messages, Gmail,
 * Outlook, WhatsApp…). Needs Android's notification access, which the person grants on the Connect tab. Nothing is
 * uploaded: the check runs on the phone. A scam gets its own warning notification with a "See why" button.
 */
class MessageWatcher : NotificationListenerService() {
    private val seen = LinkedHashSet<Int>()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (!watches(sbn.packageName, n)) return
        val store = Store(this)
        if (!store.scanMessages) return
        val (from, text) = content(n) ?: return
        val key = (sbn.packageName + from + text).hashCode()
        if (!seen.add(key)) return
        if (seen.size > 200) seen.remove(seen.first())
        val verdict = LinkCheck.message(text)
        Log.i(TAG, "checked a message from ${sbn.packageName}: ${verdict.level}")
        if (verdict.level == "safe") return
        val app = appName(sbn.packageName)
        val summary = verdict.reasons.take(2).joinToString(" ").ifBlank { "It uses tricks scammers use." }
        store.addEvent("message", "${if (verdict.level == "scam") "Scam" else "Suspicious"} $app message from $from", summary, blocked = verdict.level == "scam")
        Notifications.scamMessage(this, app, from, text, verdict.level == "scam", summary)
    }

    private fun watches(pkg: String, n: Notification) =
        pkg in APPS || n.category == Notification.CATEGORY_MESSAGE || n.category == Notification.CATEGORY_EMAIL

    /** Sender and the full text the notification shows, including conversation-style and inbox-style notifications. */
    private fun content(n: Notification): Pair<String, String>? {
        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val parts = mutableListOf<String>()
        NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(n)?.messages?.takeLast(3)?.forEach { m -> m.text?.let { parts += it.toString() } }
        if (parts.isEmpty()) {
            (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.let { parts += it.toString() }
            extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach { parts += it.toString() }
        }
        val text = parts.joinToString("\n").trim()
        // Android 15 hides some message text (one-time codes) from apps; there's nothing to check then.
        if (text.length < 8 || text.startsWith("Sensitive notification content hidden")) return null
        return title.ifBlank { "unknown sender" } to text
    }

    private fun appName(pkg: String) = runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }.getOrDefault("a")

    companion object {
        const val TAG = "CallCanary"
        private val APPS = setOf(
            "com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.android.messaging",
            "com.google.android.gm", "com.microsoft.office.outlook", "com.yahoo.mobile.client.android.mail", "com.samsung.android.email.provider",
            "com.whatsapp", "com.facebook.orca", "org.telegram.messenger", "org.thoughtcrime.securesms",
        )

        fun enabled(context: Context): Boolean {
            val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
            return flat.split(':').any { ComponentName.unflattenFromString(it)?.packageName == context.packageName }
        }
    }
}
