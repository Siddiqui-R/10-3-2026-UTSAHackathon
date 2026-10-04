package com.callcanary.app.ui.demo

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.callcanary.app.data.Store
import com.callcanary.app.ui.BigButton
import com.callcanary.app.ui.CC
import com.callcanary.app.ui.Hero

/** The demo scenes, in tour order. Scripted and offline, so a presentation never depends on the network. */
enum class Scene(val title: String, val caption: String) {
    GMAIL("Gmail scan", "Connect Gmail and CallCanary checks every email, moving phishing to Scam."),
    WEB("Scam website blocked", "rnicrosoft.com looks like Microsoft. CallCanary spots the trick and blocks it."),
    TEXT("Scam text", "Fake delivery fees and look-alike links in texts are flagged and blocked."),
    ROBOCALL("Reported robocall", "Numbers reported to the FTC are blocked before your phone rings."),
    LIVE("Live call protection", "You answer a call. CallCanary listens, warns you the moment it turns into a scam, and blocks the number."),
    SCREENER("AI call screener", "Unknown callers talk to CallCanary first. Its AI decides if it's a scam."),
    SUMMARY("You're protected", "Every blocked call, website, text and email, in one place."),
}

@Composable
fun DemoTourScreen(onPlay: (List<Scene>) -> Unit) {
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Demo", "See CallCanary in action", "Play the full tour for a presentation, or tap one feature. Sound on.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            BigButton("▶  Play full tour", { onPlay(Scene.entries) }, color = CC.Lamp, textColor = CC.Coal)
            Scene.entries.forEachIndexed { i, scene ->
                Card(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).clickable { onPlay(listOf(scene)) }, shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White), border = BorderStroke(2.dp, Color(0xFFDCE3DC))) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.size(42.dp).background(CC.Coal, CircleShape), contentAlignment = Alignment.Center) {
                            Text("${i + 1}", color = CC.Lamp, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                        }
                        Column(Modifier.weight(1f)) {
                            Text(scene.title, style = MaterialTheme.typography.titleLarge)
                            Text(scene.caption, color = CC.Muted, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

/** Runs scenes full screen, one after another, with a caption bar and controls to skip or close. */
@Composable
fun DemoStage(scenes: List<Scene>, store: Store, onExit: () -> Unit) {
    var index by remember { mutableIntStateOf(0) }
    val next: () -> Unit = { if (index + 1 < scenes.size) index++ else onExit() }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AnimatedContent(targetState = index, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "scene") { i ->
            // A scene still fading out must not advance the tour a second time.
            val done: () -> Unit = { if (index == i) next() }
            Box(Modifier.fillMaxSize()) {
                when (scenes[i]) {
                    Scene.GMAIL -> GmailScene(store, done)
                    Scene.WEB -> WebScene(store, done)
                    Scene.TEXT -> TextScene(store, done)
                    Scene.ROBOCALL -> RobocallScene(store, done)
                    Scene.LIVE -> LiveCallScene(store, done)
                    Scene.SCREENER -> ScreenerScene(store, done)
                    Scene.SUMMARY -> SummaryScene(store, done)
                }
            }
        }
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            Row(Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = next, modifier = Modifier.size(48.dp).background(Color.Black.copy(alpha = 0.35f), CircleShape)) {
                    Icon(Icons.Filled.SkipNext, contentDescription = "Next scene", tint = Color.White)
                }
                IconButton(onClick = onExit, modifier = Modifier.padding(start = 8.dp).size(48.dp).background(Color.Black.copy(alpha = 0.35f), CircleShape)) {
                    Icon(Icons.Filled.Close, contentDescription = "Close demo", tint = Color.White)
                }
            }
            Box(Modifier.weight(1f))
            val scene = scenes[index]
            Column(Modifier.fillMaxWidth().padding(12.dp).background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(18.dp)).padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${Scene.entries.indexOf(scene) + 1} · ${scene.title.uppercase()}", color = CC.Lamp, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                Text(scene.caption, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, lineHeight = 21.sp)
            }
        }
    }
}
