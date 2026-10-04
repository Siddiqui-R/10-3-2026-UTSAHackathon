package com.callcanary.app.listen

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.telecom.TelecomManager
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.callcanary.app.Notifications
import com.callcanary.app.R
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ScamSignals
import com.callcanary.app.data.Store
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import org.vosk.Model
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Live call protection: listens to a call on speaker, scores what the caller says and warns the moment it sounds like a scam. */
class LiveCallService : Service() {
    data class State(
        val phase: Phase = Phase.Idle,
        val number: String? = null,
        val transcript: String = "",
        val partial: String = "",
        val score: Int = 0,
        val signals: List<ScamSignal> = emptyList(),
        val downloadProgress: Float = 0f,
        val recording: File? = null,
        val error: String? = null,
        /** The website AI's latest read of the call, when online and allowed. */
        val ai: com.callcanary.app.data.CheckApi.CallVerdict? = null,
        /** Shown after "Block": Android may not let CallCanary end the call itself. */
        val note: String? = null,
    )
    data class ScamSignal(val label: String, val phrase: String, val weight: Int)
    enum class Phase { Idle, Preparing, Listening, Alert, Ended }

    private var listener: CallListener? = null
    private var model: Model? = null
    private var tts: TextToSpeech? = null
    private var callWatcher: TelephonyCallback? = null
    private var alerted = false
    @Volatile private var aiBusy = false
    private var aiAt = 0L
    private var aiWords = 0
    private lateinit var store: Store

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() { super.onCreate(); store = Store(this) }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> finish("Stopped listening")
            ACTION_HANG_UP -> {
                val ended = hangUpAndBlock()
                finish(if (ended) "Hung up and blocked" else "Blocked the caller")
                if (!ended) _state.update { it.copy(note = "Blocked. Now press the red button on the call screen to hang up.") }
            }
            else -> begin(intent?.getStringExtra(EXTRA_NUMBER))
        }
        return START_NOT_STICKY
    }

    private fun begin(number: String?) {
        if (_state.value.phase == Phase.Listening || _state.value.phase == Phase.Preparing) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            _state.value = State(phase = Phase.Ended, error = "CallCanary needs the microphone to listen."); stopSelf(); return
        }
        Notifications.ensureChannel(this)
        startForeground(NOTIFY_ID, ongoing("Getting ready to listen…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        alerted = false; aiBusy = false; aiAt = 0L; aiWords = 0
        _state.value = State(phase = Phase.Preparing, number = PhoneNumbers.normalizeUs(number) ?: number)
        if (store.speakWarnings) tts = TextToSpeech(this) { status -> if (status == TextToSpeech.SUCCESS) tts?.language = Locale.US }
        watchForCallEnd()
        Thread({
            try {
                if (!SpeechModel.ready(this)) SpeechModel.download(this) { p -> _state.update { it.copy(downloadProgress = p) } }
                val loaded = model ?: Model(SpeechModel.dir(this).absolutePath).also { model = it }
                val file = if (store.recordCalls) File(recordingsDir(this), "call-${stamp()}.wav") else null
                listener = CallListener(loaded, file, ::onText).also { l ->
                    // Debug builds: `adb` can drop a recorded call in files/test-call.pcm to test without a real call. Used once.
                    if (com.callcanary.app.BuildConfig.DEBUG) File(filesDir, "test-call.pcm").takeIf { it.exists() }?.let { t ->
                        val copy = File(cacheDir, "test-call.pcm"); t.copyTo(copy, overwrite = true); t.delete(); l.testAudio = copy }
                    l.start()
                }
                _state.update { it.copy(phase = Phase.Listening, recording = file) }
                NotificationManagerCompat.from(this).notifySafely(NOTIFY_ID, ongoing("Listening for scam tricks. Keep the call on speaker."))
            } catch (e: Exception) {
                Log.e(TAG, "couldn't start listening", e)
                _state.update { it.copy(phase = Phase.Ended, error = "Couldn't start listening: ${e.message ?: "no network for the first-time download?"}") }
                stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
            }
        }, "LiveCallStart").start()
    }

    private fun onText(finalText: String, partial: String) {
        _state.update { s ->
            val transcript = if (finalText.isBlank()) s.transcript else (s.transcript + " " + finalText).trim()
            // Score the recent conversation (about the last 40 seconds of speech), like the website does.
            val result = ScamSignals.score((transcript + " " + partial).takeLast(700))
            s.copy(transcript = transcript, partial = partial, score = maxOf(s.score, result.score),
                signals = (s.signals + result.signals.map { ScamSignal(it.label, it.phrase, it.weight) }).distinctBy { it.label }.sortedByDescending { it.weight })
        }
        val s = _state.value
        if (!alerted && s.score >= ScamSignals.THRESHOLD) { alerted = true; raiseAlert(s) }
        if (finalText.isNotBlank()) askAi(s.transcript)
    }

    /**
     * A second opinion from the website's AI, which judges who is asking whom to do what (phrases alone can miss a new
     * script). At most every 12 seconds, only when new words arrived. It can raise the alarm but never lowers one.
     */
    private fun askAi(transcript: String) {
        val words = transcript.split(' ').size
        val now = System.currentTimeMillis()
        if (!store.aiSecondOpinion || aiBusy || words < 12 || words <= aiWords || now - aiAt < 12_000) return
        aiBusy = true; aiAt = now; aiWords = words
        Thread({
            try {
                val verdict = com.callcanary.app.data.CheckApi.analyzeCall(transcript) ?: return@Thread
                val phase = _state.value.phase
                if (phase != Phase.Listening && phase != Phase.Alert) return@Thread
                _state.update { it.copy(ai = verdict) }
                if (verdict.level == "scam" && !alerted) { alerted = true; raiseAlert(_state.value, verdict.reasons.firstOrNull()) }
            } finally { aiBusy = false }
        }, "LiveCallAi").start()
    }

    private fun raiseAlert(s: State, aiReason: String? = null) {
        _state.update { it.copy(phase = Phase.Alert) }
        val reasons = aiReason?.trimEnd('.')?.replaceFirstChar { it.lowercase() } ?: s.signals.take(2).joinToString(" and ") { it.label.lowercase() }
        getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 200, 400, 200, 800), -1))
        Notifications.scamAlert(this, s.number?.let { PhoneNumbers.format(it) }, reasons)
        if (store.speakWarnings) tts?.speak("CallCanary warning. This sounds like a scam: $reasons. Do not send money or share any codes. You can hang up.",
            TextToSpeech.QUEUE_FLUSH, null, "alert")
        store.addEvent("live", "Scam warning during a call", reasons.replaceFirstChar { it.uppercase() }, blocked = false)
    }

    /** Blocks the caller and tries to end the call; Android 10+ usually only lets the phone app hang up, so this returns whether it did. */
    private fun hangUpAndBlock(): Boolean {
        val number = _state.value.number
        val ended = ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED &&
            @Suppress("DEPRECATION") runCatching { getSystemService(TelecomManager::class.java).endCall() }.getOrDefault(false)
        if (number != null && PhoneNumbers.normalizeUs(number) != null) {
            val reasons = _state.value.signals.take(2).joinToString(", ") { it.label }.ifBlank { "You hung up on this caller" }
            store.block(number, reasons)
            store.addEvent("call", "Blocked ${PhoneNumbers.format(number)}", reasons, blocked = true)
        }
        return ended
    }

    private fun finish(title: String) {
        listener?.stop(); listener = null
        unwatchCallEnd()
        val s = _state.value
        if (s.transcript.isNotBlank() || s.recording != null) saveTranscript(s)
        if (s.phase == Phase.Listening || s.phase == Phase.Alert)
            store.addEvent("live", title, if (s.score >= ScamSignals.THRESHOLD) "Scam score ${s.score}" else "No scam tricks heard", blocked = false)
        _state.update { it.copy(phase = Phase.Ended, partial = "") }
        tts?.shutdown(); tts = null
        stopForeground(STOP_FOREGROUND_REMOVE); stopSelf()
    }

    private fun saveTranscript(s: State) = runCatching {
        val base = s.recording?.nameWithoutExtension ?: "call-${stamp()}"
        File(recordingsDir(this), "$base.txt").writeText(buildString {
            appendLine("Caller: ${s.number?.let { PhoneNumbers.format(it) } ?: "unknown"}")
            appendLine("Scam score: ${s.score}")
            s.signals.forEach { appendLine("- ${it.label}: \"${it.phrase}\"") }
            appendLine(); append(s.transcript)
        })
    }

    // End listening by itself when the call hangs up (needs the phone-state permission; otherwise the person taps Stop).
    private fun watchForCallEnd() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED || Build.VERSION.SDK_INT < 31) return
        val telephony = getSystemService(TelephonyManager::class.java) ?: return
        var sawCall = false
        val watcher = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
            override fun onCallStateChanged(state: Int) {
                if (state == TelephonyManager.CALL_STATE_OFFHOOK) sawCall = true
                if (state == TelephonyManager.CALL_STATE_IDLE && sawCall) finish("Call ended")
            }
        }
        runCatching { telephony.registerTelephonyCallback(mainExecutor, watcher); callWatcher = watcher }
    }
    private fun unwatchCallEnd() {
        callWatcher?.let { w -> runCatching { getSystemService(TelephonyManager::class.java)?.unregisterTelephonyCallback(w) } }
        callWatcher = null
    }

    private fun ongoing(text: String): Notification {
        val open = PendingIntent.getActivity(this, 1, Intent(this, ListenActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 2, Intent(this, LiveCallService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, Notifications.LIVE)
            .setSmallIcon(R.drawable.ic_shield).setContentTitle("CallCanary is protecting this call").setContentText(text)
            .setOngoing(true).setContentIntent(open).addAction(0, "Stop", stop).build()
    }

    private fun NotificationManagerCompat.notifySafely(id: Int, n: Notification) = runCatching { notify(id, n) }

    override fun onDestroy() { listener?.stop(); unwatchCallEnd(); tts?.shutdown(); model?.close(); model = null; super.onDestroy() }

    companion object {
        const val TAG = "CallCanary"
        private const val NOTIFY_ID = 7001
        const val ACTION_START = "com.callcanary.LISTEN"
        const val ACTION_STOP = "com.callcanary.STOP"
        const val ACTION_HANG_UP = "com.callcanary.HANG_UP"
        const val EXTRA_NUMBER = "number"

        private val _state = MutableStateFlow(State())
        val state: StateFlow<State> = _state

        fun start(context: Context, number: String?) = ContextCompat.startForegroundService(context,
            Intent(context, LiveCallService::class.java).setAction(ACTION_START).putExtra(EXTRA_NUMBER, number))
        fun send(context: Context, action: String) = context.startService(Intent(context, LiveCallService::class.java).setAction(action))

        fun recordingsDir(context: Context) = File(context.filesDir, "calls").apply { mkdirs() }
        private fun stamp() = SimpleDateFormat("yyyy-MM-dd-HHmmss", Locale.US).format(Date())
    }
}
