package com.callcanary.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Everything CallCanary keeps lives on this phone: settings, your block list and recent activity. */
class Store(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("callcanary", Context.MODE_PRIVATE)

    data class Event(val at: Long, val kind: String, val title: String, val detail: String, val blocked: Boolean)
    data class BlockedNumber(val number: String, val reason: String, val at: Long)

    var blockReported: Boolean
        get() = prefs.getBoolean("blockReported", true)
        set(value) = prefs.edit().putBoolean("blockReported", value).apply()
    /** Silence (send to voicemail quietly) instead of rejecting. */
    var silenceOnly: Boolean
        get() = prefs.getBoolean("silenceOnly", false)
        set(value) = prefs.edit().putBoolean("silenceOnly", value).apply()
    var blockHidden: Boolean
        get() = prefs.getBoolean("blockHidden", false)
        set(value) = prefs.edit().putBoolean("blockHidden", value).apply()
    /** Check new texts and emails as they arrive (once notification access is allowed). */
    var scanMessages: Boolean
        get() = prefs.getBoolean("scanMessages", true)
        set(value) = prefs.edit().putBoolean("scanMessages", value).apply()
    /** Offer to listen when an unknown number calls. */
    var offerListening: Boolean
        get() = prefs.getBoolean("offerListening", true)
        set(value) = prefs.edit().putBoolean("offerListening", value).apply()
    /** Say the scam warning out loud during a call (the caller hears it too, on speaker). */
    var speakWarnings: Boolean
        get() = prefs.getBoolean("speakWarnings", true)
        set(value) = prefs.edit().putBoolean("speakWarnings", value).apply()
    /** Save a recording of protected calls on this phone. Off by default: the person chooses, and should tell the caller. */
    var recordCalls: Boolean
        get() = prefs.getBoolean("recordCalls", false)
        set(value) = prefs.edit().putBoolean("recordCalls", value).apply()
    /** The Google account the person connected on the Connect tab, or null. */
    var gmailAccount: String?
        get() = prefs.getString("gmailAccount", null)
        set(value) = prefs.edit().putString("gmailAccount", value).apply()

    fun blocked(): List<BlockedNumber> = array("blocked").let { a ->
        List(a.length()) { a.getJSONObject(it).let { o -> BlockedNumber(o.getString("number"), o.optString("reason"), o.optLong("at")) } }
    }
    fun blockedSet(): Set<String> = blocked().map { it.number }.toSet()

    fun block(number: String, reason: String) {
        val list = blocked().filterNot { it.number == number } + BlockedNumber(number, reason, System.currentTimeMillis())
        putArray("blocked", JSONArray(list.sortedByDescending { it.at }.map { JSONObject().put("number", it.number).put("reason", it.reason).put("at", it.at) }))
    }
    fun unblock(number: String) {
        putArray("blocked", JSONArray(blocked().filterNot { it.number == number }.map { JSONObject().put("number", it.number).put("reason", it.reason).put("at", it.at) }))
    }

    fun events(): List<Event> = array("events").let { a ->
        List(a.length()) { a.getJSONObject(it).let { o -> Event(o.getLong("at"), o.getString("kind"), o.getString("title"), o.optString("detail"), o.optBoolean("blocked")) } }
    }
    /** Newest first, at most 100. */
    @Synchronized fun addEvent(kind: String, title: String, detail: String, blocked: Boolean) {
        val next = JSONArray().put(JSONObject().put("at", System.currentTimeMillis()).put("kind", kind).put("title", title).put("detail", detail).put("blocked", blocked))
        val old = array("events")
        for (i in 0 until minOf(old.length(), 99)) next.put(old.get(i))
        putArray("events", next)
    }
    fun clearEvents() = putArray("events", JSONArray())

    private fun array(key: String) = runCatching { JSONArray(prefs.getString(key, "[]")) }.getOrElse { JSONArray() }
    private fun putArray(key: String, value: JSONArray) = prefs.edit().putString(key, value.toString()).apply()
}
