package com.callcanary.app.listen

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ScamSignals
import com.callcanary.app.data.Store
import com.callcanary.app.ui.BigButton
import com.callcanary.app.ui.CC
import com.callcanary.app.ui.CallCanaryTheme
import com.callcanary.app.ui.Hero
import com.callcanary.app.ui.Mascot
import java.io.File
import java.text.DateFormat
import java.util.Date

/** Live call protection: start listening, see what the caller says and the warning, hang up and block, and replay saved calls. */
class ListenActivity : ComponentActivity() {
    private var number: String? = null
    private var refresh by mutableIntStateOf(0)
    private var player: MediaPlayer? = null
    private var playing by mutableStateOf<String?>(null)

    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.RECORD_AUDIO] == true) LiveCallService.start(this, number)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        number = intent.getStringExtra(EXTRA_NUMBER)
        val store = Store(this)
        if (intent.getBooleanExtra(EXTRA_AUTO_START, false)) startListening()
        setContent {
            CallCanaryTheme {
                val state by LiveCallService.state.collectAsState()
                Column(Modifier.fillMaxSize().background(CC.Paper).safeDrawingPadding().verticalScroll(rememberScrollState())) {
                    ListenHero(state)
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Controls(state, store)
                        Recordings(remember(refresh, state.phase) { LiveCallService.recordingsDir(this@ListenActivity).listFiles()?.sortedByDescending { it.lastModified() } ?: emptyList() })
                    }
                }
            }
        }
    }

    // Tapping "Protect this call" while this screen is already open delivers the call here instead of onCreate.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(EXTRA_NUMBER)?.let { number = it }
        if (intent.getBooleanExtra(EXTRA_AUTO_START, false)) startListening()
    }

    private fun startListening() {
        val wanted = listOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.POST_NOTIFICATIONS)
        val missing = wanted.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) LiveCallService.start(this, number) else permissions.launch(missing.toTypedArray())
    }

    @Composable
    private fun ListenHero(state: LiveCallService.State) {
        val alert = state.phase == LiveCallService.Phase.Alert
        val title = when (state.phase) {
            LiveCallService.Phase.Preparing -> if (state.downloadProgress in 0.001f..0.999f) "Getting ready" else "Starting…"
            LiveCallService.Phase.Listening -> "Listening"
            LiveCallService.Phase.Alert -> "SCAM CALL. Hang up."
            else -> if (state.note != null) "Caller blocked" else "Protect a call"
        }
        val subtitle = when (state.phase) {
            LiveCallService.Phase.Preparing -> if (state.downloadProgress > 0f) "Downloading the speech model once (about 40 MB). After this it works offline." else "Loading the speech model…"
            LiveCallService.Phase.Listening -> "Keep the call on speaker. CallCanary listens on this phone; the audio never leaves it."
            LiveCallService.Phase.Alert -> "Don't send money, buy gift cards or read any code. Real banks and agencies never ask for that."
            else -> state.note ?: state.error ?: "Put the call on speaker and tap Start. CallCanary listens for scam tricks and warns you right away."
        }
        if (alert) Column(Modifier.fillMaxWidth().background(CC.Danger).padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Mascot(awake = true, size = 110.dp)
            Text(title, color = Color.White, style = MaterialTheme.typography.headlineLarge)
            Text(subtitle, color = Color.White, style = MaterialTheme.typography.bodyLarge)
        } else Hero("Live call protection", title, subtitle) {
            if (state.phase == LiveCallService.Phase.Preparing && state.downloadProgress > 0f)
                LinearProgressIndicator(progress = { state.downloadProgress }, modifier = Modifier.fillMaxWidth().height(10.dp), color = CC.Lamp)
        }
    }

    @Composable
    private fun Controls(state: LiveCallService.State, store: Store) {
        val active = state.phase == LiveCallService.Phase.Listening || state.phase == LiveCallService.Phase.Alert || state.phase == LiveCallService.Phase.Preparing
        if (!active) {
            BigButton("Start listening", ::startListening, color = CC.Lamp, textColor = CC.Coal)
            var record by remember { mutableStateOf(store.recordCalls) }
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = BorderStroke(2.dp, Color(0xFFDCE3DC))) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row { Text("Save a recording of the call", Modifier.weight(1f), fontWeight = FontWeight.Bold)
                        androidx.compose.material3.Switch(record, { record = it; store.recordCalls = it }) }
                    Text("Kept only on this phone, with a written transcript. Recording laws differ by state: tell the other person you're recording.", color = CC.Muted, fontSize = 15.sp)
                }
            }
            return
        }
        if (state.phase != LiveCallService.Phase.Preparing) {
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = CC.Coal)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("WHAT THE CALLER IS SAYING", color = CC.Lamp, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    val words = (state.transcript + " " + state.partial).trim()
                    Text(if (words.isEmpty()) "Waiting for the caller to speak…" else "“…${words.takeLast(220)}”", color = Color.White, fontSize = 18.sp)
                }
            }
            val danger = state.score >= ScamSignals.THRESHOLD
            Text("Scam score: ${state.score}", fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, color = if (danger) CC.Danger else CC.Ink)
            LinearProgressIndicator(progress = { state.score / 100f }, modifier = Modifier.fillMaxWidth().height(12.dp), color = if (danger) CC.Danger else CC.Pine)
            state.ai?.let { ai ->
                Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = when (ai.level) { "scam" -> CC.DangerSoft; "suspicious" -> CC.WarnSoft; else -> CC.SafeSoft })) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("AI SECOND OPINION: ${when (ai.level) { "scam" -> "SCAM"; "suspicious" -> "BE CAREFUL"; else -> "SOUNDS NORMAL SO FAR" }}",
                            fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = when (ai.level) { "scam" -> CC.Danger; "suspicious" -> CC.Warn; else -> CC.Safe })
                        ai.reasons.take(3).forEach { Text(it, fontSize = 17.sp) }
                    }
                }
            }
            state.signals.forEach { s ->
                Text("⚠ ${s.label}: “${s.phrase}”", color = if (s.weight >= 25) CC.Danger else CC.Warn, fontWeight = FontWeight.Bold)
            }
        }
        val hangUpLabel = if (state.number != null && PhoneNumbers.normalizeUs(state.number) != null) "Block ${PhoneNumbers.format(state.number)} & hang up" else "Hang up"
        BigButton(hangUpLabel, { LiveCallService.send(this, LiveCallService.ACTION_HANG_UP) }, color = CC.Danger)
        BigButton("Stop listening", { LiveCallService.send(this, LiveCallService.ACTION_STOP) }, color = Color.White, textColor = CC.Pine)
    }

    @Composable
    private fun Recordings(files: List<File>) {
        if (files.isEmpty()) return
        Text("Saved calls", style = MaterialTheme.typography.titleLarge)
        files.groupBy { it.nameWithoutExtension }.forEach { (name, group) ->
            val wav = group.firstOrNull { it.extension == "wav" }
            val txt = group.firstOrNull { it.extension == "txt" }
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = BorderStroke(2.dp, Color(0xFFDCE3DC))) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(group.maxOf { it.lastModified() })), fontWeight = FontWeight.Bold)
                    txt?.let { Text(runCatching { it.readText() }.getOrDefault("").lines().take(6).joinToString("\n"), color = CC.Muted, fontSize = 15.sp) }
                    Row {
                        if (wav != null) TextButton({ toggle(wav) }) { Text(if (playing == wav.path) "Stop" else "Play recording") }
                        TextButton({ stopPlayback(); group.forEach { it.delete() }; refresh++ }) { Text("Delete", color = CC.Danger) }
                    }
                }
            }
        }
    }

    private fun toggle(file: File) {
        if (playing == file.path) { stopPlayback(); return }
        stopPlayback()
        player = runCatching { MediaPlayer().apply { setDataSource(file.path); prepare(); start(); setOnCompletionListener { stopPlayback() } } }.getOrNull()
        playing = if (player != null) file.path else null
    }
    private fun stopPlayback() { runCatching { player?.stop() }; player?.release(); player = null; playing = null }
    override fun onDestroy() { stopPlayback(); super.onDestroy() }

    companion object {
        private const val EXTRA_NUMBER = "number"
        private const val EXTRA_AUTO_START = "autoStart"
        fun intent(context: Context, number: String?, autoStart: Boolean) = Intent(context, ListenActivity::class.java)
            .putExtra(EXTRA_NUMBER, number).putExtra(EXTRA_AUTO_START, autoStart)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
}
