package com.callcanary.app.data

import com.callcanary.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Sends a link, text or email to CallCanary's checker (the website's /api/analyze-email): real link checks plus the AI. */
object CheckApi {
    data class Typo(val typo: String, val correction: String)
    data class Link(val shown: String, val actualDomain: String, val actualUrl: String, val verdict: String, val explanation: String)
    data class Sender(val claimedBrand: String, val displayName: String, val address: String, val spoofed: Boolean, val explanation: String)
    data class Result(
        val level: String, val riskScore: Int, val recommendedAction: String, val typos: List<Typo>, val links: List<Link>,
        val sender: Sender?, val pressureTactics: List<String>, val aiChecked: Boolean,
    )
    class CheckException(message: String) : Exception(message)

    suspend fun check(text: String): Result = withContext(Dispatchers.IO) {
        val connection = (URL("${BuildConfig.API_BASE}/api/analyze-email").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; doOutput = true; connectTimeout = 15_000; readTimeout = 60_000
            setRequestProperty("Content-Type", "application/json")
        }
        try {
            connection.outputStream.use { it.write(JSONObject().put("emailText", text.take(50_000)).toString().toByteArray()) }
            val ok = connection.responseCode in 200..299
            val body = (if (ok) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (!ok) throw CheckException(runCatching { JSONObject(body).getString("error") }.getOrDefault("The check could not finish. Please try again."))
            parse(JSONObject(body))
        } catch (e: CheckException) { throw e
        } catch (e: Exception) { throw CheckException("CallCanary couldn't reach its checker. Check your internet connection and try again.")
        } finally { connection.disconnect() }
    }

    fun parse(json: JSONObject): Result {
        fun JSONArray?.objects() = if (this == null) emptyList() else List(length()) { getJSONObject(it) }
        fun JSONArray?.strings() = if (this == null) emptyList() else List(length()) { getString(it) }
        val sender = json.optJSONObject("sender")?.let {
            Sender(it.optString("claimed_brand").takeUnless { b -> b == "null" }.orEmpty(), it.optString("display_name"), it.optString("address"), it.optBoolean("spoofed"), it.optString("explanation"))
        }
        return Result(
            level = json.optString("level", "suspicious"), riskScore = json.optInt("risk_score", 50),
            recommendedAction = json.optString("recommended_action"),
            typos = json.optJSONArray("typos").objects().map { Typo(it.optString("typo"), it.optString("correction")) },
            links = json.optJSONArray("links").objects().map {
                val shown = it.optString("shown_domain").takeUnless { s -> s.isBlank() || s == "null" } ?: it.optString("display_text")
                Link(shown, it.optString("actual_domain"), it.optString("actual_url"), it.optString("verdict"), it.optString("explanation"))
            },
            sender = sender, pressureTactics = json.optJSONArray("pressure_tactics").strings(), aiChecked = json.optBoolean("ai_checked"),
        )
    }
}
