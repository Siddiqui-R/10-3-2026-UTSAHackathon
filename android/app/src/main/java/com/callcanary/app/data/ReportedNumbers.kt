package com.callcanary.app.data

import android.content.Context
import org.json.JSONObject
import java.io.InputStream
import java.util.zip.GZIPInputStream

/**
 * The FTC Do Not Call "reported calls" list, bundled with the app (same file as the website: data/ftc-reported-numbers.tsv.gz).
 * About 196,000 numbers in sorted arrays, so a lookup is a binary search and works offline.
 * Reported means people complained about the number, not that fraud was proven.
 */
class ReportedNumbers private constructor(
    val from: String,
    val to: String,
    private val subjects: List<String>,
    private val phones: LongArray,
    private val reports: IntArray,
    private val last: IntArray,
    private val robo: IntArray,
    private val topic: IntArray,
) {
    data class Report(val number: String, val reports: Int, val robocallReports: Int, val lastReported: String, val topic: String)

    val size: Int get() = phones.size

    fun lookup(digits: String?): Report? {
        val target = digits?.toLongOrNull() ?: return null
        val i = phones.binarySearch(target)
        if (i < 0) return null
        val day = last[i].toString()
        return Report(digits, reports[i], robo[i], "${day.substring(0, 4)}-${day.substring(4, 6)}-${day.substring(6)}", subjects.getOrElse(topic[i]) { "Other" })
    }

    companion object {
        @Volatile private var cached: ReportedNumbers? = null

        /** Loads once per process. Call from a background thread the first time. */
        fun get(context: Context): ReportedNumbers =
            cached ?: synchronized(this) {
                cached ?: openAsset(context).use { parse(it) }.also { cached = it }
            }

        // The Android build unpacks .gz assets, so the APK holds "ftc-reported-numbers.tsv"; accept either name.
        private fun openAsset(context: Context): InputStream =
            runCatching { context.assets.open("ftc-reported-numbers.tsv") }.getOrElse { context.assets.open("ftc-reported-numbers.tsv.gz") }

        /**
         * Parses the index, gzipped or plain (detected from the first bytes): a JSON header line, then
         * "phone\treports\tYYYY-MM-DD\trobocalls\tsubjectIndex" lines.
         */
        fun parse(input: InputStream): ReportedNumbers {
            val stream = java.io.BufferedInputStream(input)
            stream.mark(2)
            val gzipped = stream.read() == 0x1f && stream.read() == 0x8b
            stream.reset()
            val reader = (if (gzipped) GZIPInputStream(stream) else stream).bufferedReader()
            val header = JSONObject(reader.readLine())
            val subjectsJson = header.getJSONArray("subjects")
            val subjects = List(subjectsJson.length()) { subjectsJson.getString(it) }
            val phones = ArrayList<Long>(200_000); val reports = ArrayList<Int>(200_000); val last = ArrayList<Int>(200_000)
            val robo = ArrayList<Int>(200_000); val topic = ArrayList<Int>(200_000)
            reader.forEachLine { line ->
                if (line.isBlank()) return@forEachLine
                val parts = line.split('\t')
                if (parts.size < 5) return@forEachLine
                phones += parts[0].toLong(); reports += parts[1].toInt(); last += parts[2].replace("-", "").toInt()
                robo += parts[3].toInt(); topic += parts[4].toInt()
            }
            return ReportedNumbers(header.getString("from"), header.getString("to"), subjects,
                phones.toLongArray(), reports.toIntArray(), last.toIntArray(), robo.toIntArray(), topic.toIntArray())
        }
    }
}
