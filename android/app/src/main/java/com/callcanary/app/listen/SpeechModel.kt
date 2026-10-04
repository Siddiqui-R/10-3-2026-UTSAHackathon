package com.callcanary.app.listen

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/**
 * The offline speech model (Vosk small English, free and open source, about 40 MB). It's downloaded once on first use
 * and kept on the phone, so listening works without a network afterwards and no audio ever leaves the phone.
 */
object SpeechModel {
    private const val URL_ZIP = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"

    fun dir(context: Context) = File(context.filesDir, "vosk-model")
    fun ready(context: Context) = File(dir(context), "conf/model.conf").exists()

    /** Downloads and unpacks the model; [onProgress] gets 0..1. Blocking: call off the main thread. */
    fun download(context: Context, onProgress: (Float) -> Unit) {
        if (ready(context)) return
        val target = dir(context)
        val staging = File(context.filesDir, "vosk-model-tmp").apply { deleteRecursively(); mkdirs() }
        val connection = URL(URL_ZIP).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000; connection.readTimeout = 30_000
        try {
            val total = connection.contentLengthLong.takeIf { it > 0 } ?: 41_205_931L
            var read = 0L
            val counting = object : java.io.FilterInputStream(connection.inputStream) {
                override fun read(b: ByteArray, off: Int, len: Int) = super.read(b, off, len).also { if (it > 0) { read += it; onProgress((read.toFloat() / total).coerceAtMost(1f)) } }
            }
            ZipInputStream(counting.buffered()).use { zip ->
                generateSequence { zip.nextEntry }.forEach { entry ->
                    // Drop the zip's top folder (vosk-model-small-en-us-0.15/...).
                    val inner = entry.name.substringAfter('/', "")
                    if (inner.isEmpty()) return@forEach
                    val out = File(staging, inner)
                    require(out.canonicalPath.startsWith(staging.canonicalPath)) { "bad zip entry" }
                    if (entry.isDirectory) out.mkdirs() else { out.parentFile?.mkdirs(); out.outputStream().use { zip.copyTo(it) } }
                }
            }
        } finally { connection.disconnect() }
        target.deleteRecursively()
        check(staging.renameTo(target)) { "couldn't save the speech model" }
    }
}
