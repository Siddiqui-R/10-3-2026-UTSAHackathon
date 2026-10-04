package com.callcanary.app.listen

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.File
import java.io.RandomAccessFile

/**
 * Listens through the microphone (the call on speaker) and turns speech into text on the phone with Vosk.
 * Android doesn't let apps tap call audio directly, so speakerphone + mic is the honest way to hear the caller.
 * The same audio stream can be saved as a WAV recording when the person turns recording on.
 */
class CallListener(private val model: Model, private val recordTo: File?, private val onText: (finalText: String, partial: String) -> Unit) {
    /** Debug builds only: 16 kHz mono PCM played through the same pipeline instead of the microphone, at real-time pace. */
    var testAudio: File? = null
    @Volatile private var running = false
    private var thread: Thread? = null

    @SuppressLint("MissingPermission") // The caller checks RECORD_AUDIO before starting.
    fun start() {
        if (running) return
        running = true
        thread = Thread({ loop() }, "CallListener").apply { start() }
    }

    fun stop() { running = false; thread?.join(2000); thread = null }

    @SuppressLint("MissingPermission")
    private fun loop() {
        val minBuffer = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        // VOICE_RECOGNITION skips the noise suppression that swallows speakerphone voices on some phones.
        val test = testAudio?.inputStream()
        val record = if (test != null) null else AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuffer, RATE))
        val recognizer = Recognizer(model, RATE.toFloat())
        val wav = recordTo?.let { RandomAccessFile(it, "rw").apply { setLength(0); write(ByteArray(44)) } }
        var bytes = 0L
        val buffer = ByteArray(4096)
        try {
            record?.startRecording()
            while (running) {
                val n = if (test != null) test.read(buffer).also { Thread.sleep(buffer.size * 1000L / (RATE * 2)) } else record!!.read(buffer, 0, buffer.size)
                if (n < 0) break
                if (n == 0) continue
                wav?.write(buffer, 0, n); bytes += n
                if (recognizer.acceptWaveForm(buffer, n)) onText(text(recognizer.result, "text"), "")
                else onText("", text(recognizer.partialResult, "partial"))
            }
            onText(text(recognizer.finalResult, "text"), "")
        } finally {
            runCatching { record?.stop() }; record?.release(); test?.close(); recognizer.close()
            wav?.let { writeWavHeader(it, bytes); it.close() }
        }
    }

    private fun text(json: String, key: String) = runCatching { JSONObject(json).optString(key) }.getOrDefault("")

    private fun writeWavHeader(file: RandomAccessFile, dataBytes: Long) {
        fun le(v: Long, size: Int) = ByteArray(size) { i -> (v shr (8 * i) and 0xFF).toByte() }
        file.seek(0)
        file.write("RIFF".toByteArray()); file.write(le(36 + dataBytes, 4)); file.write("WAVEfmt ".toByteArray())
        file.write(le(16, 4)); file.write(le(1, 2)); file.write(le(1, 2)); file.write(le(RATE.toLong(), 4))
        file.write(le(RATE * 2L, 4)); file.write(le(2, 2)); file.write(le(16, 2))
        file.write("data".toByteArray()); file.write(le(dataBytes, 4))
    }

    companion object { const val RATE = 16000 }
}
