package com.callcanary.app.ui.demo

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Dialpad
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.RemoveCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.callcanary.app.Notifications
import com.callcanary.app.R
import com.callcanary.app.data.ReportedNumbers
import com.callcanary.app.data.Store
import com.callcanary.app.ui.CC
import com.callcanary.app.ui.Mascot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlin.math.ceil

// ───────────────────────── Shared pieces ─────────────────────────

private val CallBackground = Brush.verticalGradient(listOf(Color(0xFF3A3A3C), Color(0xFF1C1C1E), Color.Black))
private val CoalBackground = Brush.verticalGradient(listOf(CC.Coal2, CC.Coal))
private val AlarmBackground = Brush.verticalGradient(listOf(Color(0xFFC4161C), Color(0xFF8F0F15)))
private val Red = Color(0xFFFF3B30)
private val Green = Color(0xFF34C759)
private const val CAPTION_SPACE = 130 // room for the tour's caption bar

@Composable
private fun pulse(min: Float = 1f, max: Float = 1.1f, ms: Int = 700): Float {
    val t = rememberInfiniteTransition(label = "pulse")
    val v by t.animateFloat(min, max, infiniteRepeatable(tween(ms), RepeatMode.Reverse), label = "pulse")
    return v
}

@Composable
private fun RoundButton(icon: ImageVector, label: String, color: Color, iconTint: Color = Color.White, scale: Float = 1f) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.scale(scale).size(76.dp).background(color, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = label, tint = iconTint, modifier = Modifier.size(36.dp))
        }
        Text(label, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** The phone's own incoming-call screen. */
@Composable
private fun IncomingCall(number: String, accept: Boolean = false, screenButton: Boolean = false, banner: @Composable () -> Unit = {}) {
    Column(Modifier.fillMaxSize().background(CallBackground).safeDrawingPadding().padding(bottom = CAPTION_SPACE.dp, top = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.AccountCircle, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(96.dp))
        Text("Unknown", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
        Text("$number · mobile", color = Color.White.copy(alpha = 0.7f), fontSize = 18.sp)
        Text("incoming call…", color = Color.White.copy(alpha = 0.55f), fontSize = 15.sp)
        Spacer(Modifier.height(20.dp)); banner()
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            RoundButton(Icons.Filled.CallEnd, "Decline", Red)
            if (screenButton) RoundButton(Icons.Filled.Shield, "Screen", CC.Lamp, CC.Coal, pulse())
            RoundButton(Icons.Filled.Call, "Accept", Green, scale = if (accept) 0.85f else if (screenButton) 1f else pulse())
        }
    }
}

/** CallCanary's banner across the top of another screen. */
@Composable
private fun CanaryPill(text: String, busy: Boolean = false) {
    Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().background(Color.White.copy(alpha = 0.12f), RoundedCornerShape(18.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(28.dp).background(CC.Lamp, RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Shield, contentDescription = null, tint = CC.Coal, modifier = Modifier.size(18.dp))
        }
        Text(text, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f))
        if (busy) LinearProgressIndicator(Modifier.width(48.dp), color = CC.Lamp, trackColor = Color.White.copy(alpha = 0.2f))
    }
}

/** Splits a look-alike and the real address into same / different / same parts. */
private fun diff(fake: String, real: String): Pair<List<String>, List<String>> {
    var start = 0; while (start < minOf(fake.length, real.length) && fake[start] == real[start]) start++
    var end = 0; while (end < minOf(fake.length, real.length) - start && fake[fake.length - 1 - end] == real[real.length - 1 - end]) end++
    return listOf(fake.take(start), fake.substring(start, fake.length - end), fake.takeLast(end)) to
        listOf(real.take(start), real.substring(start, real.length - end), real.takeLast(end))
}

/** CallCanary's block page, shown instead of a scam website. */
@Composable
private fun BlockedSitePage(fake: String, real: String, brand: String, reasons: List<String>) {
    val (f, r) = diff(fake, real)
    Column(Modifier.fillMaxSize().background(AlarmBackground).safeDrawingPadding().padding(start = 22.dp, end = 22.dp, top = 56.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Filled.Block, contentDescription = null, tint = Color.White, modifier = Modifier.size(84.dp))
        Text("Website blocked", color = Color.White, fontSize = 36.sp, fontWeight = FontWeight.ExtraBold)
        Text(fake, color = Color(0xFFFFE08A), fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Column(Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(18.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(buildAnnotatedString { append("It looks like "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(brand) }; append(", but it isn't:") }, color = Color.White, fontSize = 17.sp)
            listOf(f to Color(0xFFFFE08A), r to Color(0xFFA8F0C0)).forEachIndexed { i, (parts, mark) ->
                Text(buildAnnotatedString {
                    append(parts[0]); withStyle(SpanStyle(background = mark, color = CC.Coal)) { append(parts[1]) }; append(parts[2])
                    withStyle(SpanStyle(fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f))) { append(if (i == 0) "   fake" else "   real") }
                }, color = Color.White, fontSize = 26.sp, fontFamily = FontFamily.Monospace)
            }
        }
        reasons.forEach { reason ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = Color(0xFFFFE08A), modifier = Modifier.size(22.dp))
                Text(reason, color = Color.White, fontSize = 17.sp)
            }
        }
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(18.dp)).padding(18.dp), contentAlignment = Alignment.Center) {
            Text("← Back to safety", color = CC.Danger, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

// ───────────────────────── 1. Gmail scan ─────────────────────────

private data class DemoMail(val from: String, val address: String, val subject: String, val preview: String, val scam: Boolean)
private val mails = listOf(
    DemoMail("PayPal Support", "support@paypa1-secure.ru", "Urgent: Your PayPal account has been suspended", "We have detected unusual activty on your account…", true),
    DemoMail("Sarah Miller", "sarah.miller@gmail.com", "Photos from the lake", "Hi Mom! Here are the photos from our trip…", false),
    DemoMail("Microsoft Account Team", "no-reply@rnicrosoft-support.com", "Unusual sign-in activity", "Secure your account within 24 hours…", true),
    DemoMail("CVS Pharmacy", "noreply@cvs.com", "Your prescription is ready", "Your refill is ready for pickup at your usual store.", false),
)

@Composable
fun GmailScene(store: Store, onDone: () -> Unit) {
    var connected by remember { mutableStateOf(false) }
    val status = remember { mutableStateListOf(0, 0, 0, 0) } // 0 waiting, 1 checking, 2 safe, 3 scam
    var moved by remember { mutableStateOf(setOf<Int>()) }
    var scamFolder by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(1800); connected = true; delay(700)
        for (i in mails.indices) { status[i] = 1; delay(650); status[i] = if (mails[i].scam) 3 else 2; delay(250) }
        delay(800)
        for (i in mails.indices) if (mails[i].scam) { moved = moved + i; delay(450) }
        store.addEvent("email", "Moved 2 phishing emails to Scam", "Fake PayPal and Microsoft emails", blocked = true)
        delay(700); scamFolder = true; delay(1500); detail = true; delay(6500); onDone()
    }
    Box(Modifier.fillMaxSize().background(Color.White)) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(bottom = CAPTION_SPACE.dp)) {
            Row(Modifier.padding(start = 16.dp, end = 120.dp, top = 12.dp).fillMaxWidth().background(Color(0xFFEFF2F6), RoundedCornerShape(28.dp)).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Filled.Search, contentDescription = null, tint = Color.Gray); Text("Search in mail", color = Color.Gray, fontSize = 17.sp)
            }
            if (!connected) Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Mascot(awake = true, size = 120.dp)
                Text("Connect Gmail to CallCanary", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center, color = CC.Ink)
                Text("CallCanary will check every new email for phishing, fake senders and look-alike links.", fontSize = 17.sp, color = CC.Muted, textAlign = TextAlign.Center)
                Spacer(Modifier.height(16.dp))
                Box(Modifier.scale(pulse(1f, 1.05f)).background(CC.Pine, RoundedCornerShape(16.dp)).padding(horizontal = 28.dp, vertical = 16.dp)) {
                    Text("Allow access", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    FolderChip("Inbox ${mails.indices.count { it !in moved }}", !scamFolder, CC.Pine)
                    FolderChip("Scam ${moved.size}", scamFolder, CC.Danger)
                    Spacer(Modifier.weight(1f))
                    Text("Protected by CallCanary", color = CC.Safe, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                mails.forEachIndexed { i, mail ->
                    AnimatedVisibility(visible = if (scamFolder) i in moved else i !in moved, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
                        MailRow(mail, status[i])
                    }
                }
            }
        }
        AnimatedVisibility(detail, enter = slideInVertically { it / 3 } + fadeIn()) { MailDetail(mails[0]) }
    }
}

@Composable
private fun FolderChip(text: String, on: Boolean, color: Color) {
    Text(text, color = if (on) Color.White else CC.Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp,
        modifier = Modifier.background(if (on) color else Color(0xFFEFF2F6), RoundedCornerShape(20.dp)).padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
private fun MailRow(mail: DemoMail, status: Int) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(44.dp).background(if (mail.scam) Color(0xFF5B6CFF) else Color(0xFF2E9E6B), CircleShape), contentAlignment = Alignment.Center) {
            Text(mail.from.take(1), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        }
        Column(Modifier.weight(1f)) {
            Text(mail.from, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = CC.Ink)
            Text(mail.subject, fontSize = 16.sp, color = CC.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(mail.preview, fontSize = 15.sp, color = CC.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val (label, bg, fg) = when (status) {
                1 -> Triple("CallCanary is checking…", Color(0xFFFFF4C7), CC.Warn)
                2 -> Triple("✓ Safe", CC.SafeSoft, CC.Safe)
                3 -> Triple("Phishing — moved to Scam", CC.Danger, Color.White)
                else -> Triple("Waiting", Color(0xFFEFF2F6), CC.Muted)
            }
            Text(label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 4.dp).background(bg, RoundedCornerShape(12.dp)).padding(horizontal = 10.dp, vertical = 3.dp))
        }
    }
}

@Composable
private fun MailDetail(mail: DemoMail) {
    Column(Modifier.fillMaxSize().background(Color.White).safeDrawingPadding().padding(start = 18.dp, end = 18.dp, top = 64.dp, bottom = CAPTION_SPACE.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = CC.Ink); Text("  Scam", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = CC.Ink)
        }
        Text(mail.subject, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CC.Ink)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${mail.from} · ${mail.address}", fontSize = 15.sp, color = CC.Muted, modifier = Modifier.weight(1f))
            Text("FAKE SENDER", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.background(CC.Danger, RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 3.dp))
        }
        Column(Modifier.fillMaxWidth().background(AlarmBackground, RoundedCornerShape(22.dp)).padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Mascot(awake = true, size = 64.dp)
                Text("Phishing email", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
            }
            Text("3 spelling mistakes:", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            listOf("activty" to "activity", "permenantly" to "permanently", "Sincerly" to "Sincerely").forEach { (bad, good) ->
                Text(buildAnnotatedString {
                    withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough, color = Color.White.copy(alpha = 0.75f))) { append(bad) }
                    append("  →  "); withStyle(SpanStyle(color = Color(0xFFFFE08A), fontWeight = FontWeight.Bold)) { append(good) }
                }, color = Color.White, fontSize = 20.sp)
            }
            Text(buildAnnotatedString {
                append("Link says "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("paypal.com") }
                append(", actually goes to "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = Color(0xFFFFE08A))) { append("paypa1-secure.ru") }
            }, color = Color.White, fontSize = 18.sp, modifier = Modifier.background(Color.Black.copy(alpha = 0.22f), RoundedCornerShape(12.dp)).padding(10.dp))
            Text("Don't click anything. CallCanary moved this to Scam.", color = Color.White, fontSize = 17.sp)
        }
    }
}

// ───────────────────────── 2. Scam website ─────────────────────────

@Composable
fun WebScene(store: Store, onDone: () -> Unit) {
    val url = "rnicrosoft.com/account/verify"
    var typed by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var blocked by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(900)
        for (i in 1..url.length) { typed = url.take(i); delay(55) }
        delay(400); loading = true; delay(1000); blocked = true
        store.addEvent("web", "Blocked rnicrosoft.com", "Pretends to be Microsoft", blocked = true)
        delay(7500); onDone()
    }
    Box(Modifier.fillMaxSize().background(Color.White)) {
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            Row(Modifier.padding(start = 12.dp, end = 120.dp, top = 12.dp).fillMaxWidth().background(Color(0xFFEFF2F6), RoundedCornerShape(26.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                Text(typed.ifEmpty { "Search or type web address" } + if (!loading && typed.isNotEmpty()) "|" else "", fontSize = 17.sp, color = if (typed.isEmpty()) Color.Gray else CC.Ink, maxLines = 1)
            }
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp), color = Color(0xFF1A73E8))
            Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text("A link from an email: “Secure your account”", fontSize = 18.sp, color = CC.Muted, textAlign = TextAlign.Center)
            }
        }
        AnimatedVisibility(blocked, enter = slideInVertically { it } + fadeIn()) {
            BlockedSitePage("rnicrosoft.com", "microsoft.com", "Microsoft",
                listOf("rnicrosoft.com pretends to be Microsoft, but it is not Microsoft's real website.", "Scammers swap “m” for “r n” because they look alike at a glance."))
        }
    }
}

// ───────────────────────── 3. Scam text ─────────────────────────

@Composable
fun TextScene(store: Store, onDone: () -> Unit) {
    var shown by remember { mutableStateOf(false) }
    var flagged by remember { mutableStateOf(false) }
    var tapped by remember { mutableStateOf(false) }
    var page by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(700); shown = true; delay(1700); flagged = true
        store.block("8335550172", "Scam text with a fake delivery link")
        store.addEvent("text", "Flagged a scam text from (833) 555-0172", "Fake USPS fee with a look-alike link", blocked = true)
        delay(2800); tapped = true; delay(600); page = true; delay(6500); onDone()
    }
    Box(Modifier.fillMaxSize().background(Color.White)) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(bottom = CAPTION_SPACE.dp)) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 120.dp, top = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = CC.Ink)
                Icon(Icons.Filled.AccountCircle, contentDescription = null, tint = Color(0xFF7A869A), modifier = Modifier.size(40.dp))
                Text("+1 (833) 555-0172", fontSize = 19.sp, fontWeight = FontWeight.Bold, color = CC.Ink)
            }
            Spacer(Modifier.height(24.dp))
            AnimatedVisibility(shown, enter = slideInVertically { it / 2 } + fadeIn()) {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Today 10:03 AM", fontSize = 13.sp, color = CC.Muted, modifier = Modifier.align(Alignment.CenterHorizontally))
                    Text(buildAnnotatedString {
                        append("USPS: Your package could not be delivered due to an incomplete address. Pay the \$0.30 redelivery fee today: ")
                        withStyle(SpanStyle(color = Color(0xFF1A73E8), textDecoration = TextDecoration.Underline, background = if (tapped) Color(0xFFD2E3FC) else Color.Transparent)) { append("usps-track-secure.ru/pay") }
                    }, fontSize = 18.sp, color = CC.Ink, lineHeight = 25.sp,
                        modifier = Modifier.widthIn(max = 320.dp).background(Color(0xFFEFF2F6), RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 4.dp))
                            .then(if (flagged) Modifier.border(2.dp, CC.Danger, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 4.dp)) else Modifier).padding(14.dp))
                    AnimatedVisibility(flagged, enter = scaleIn() + fadeIn()) {
                        Row(Modifier.fillMaxWidth().background(AlarmBackground, RoundedCornerShape(18.dp)).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Mascot(awake = true, size = 56.dp)
                            Column {
                                Text("Scam text", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                                Text("Fake USPS fee with a look-alike link. Sender blocked. Don't tap the link.", color = Color.White, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }
        }
        AnimatedVisibility(page, enter = slideInVertically { it } + fadeIn()) {
            BlockedSitePage("usps-track-secure.ru", "usps.com", "USPS",
                listOf("usps-track-secure.ru pretends to be USPS, but it is not USPS's real website.", "The address ends in “.ru”, an ending scammers use a lot."))
        }
    }
}

// ───────────────────────── 4. Reported robocall ─────────────────────────

@Composable
fun RobocallScene(store: Store, onDone: () -> Unit) {
    val context = LocalContext.current
    var phase by remember { mutableStateOf("ringing") }
    var reason by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        delay(1800); phase = "checking"
        // The real offline FTC lookup the call screener uses.
        val report = withContext(Dispatchers.IO) { runCatching { ReportedNumbers.get(context).lookup("2012663840") }.getOrNull() }
        reason = report?.let { "Reported to the FTC ${it.reports} times (${it.topic})" } ?: "Reported scam number"
        delay(900); phase = "blocked"
        store.block("2012663840", reason)
        store.addEvent("call", "Blocked a call from (201) 266-3840", reason, blocked = true)
        Notifications.blockedCall(context, "(201) 266-3840", reason, silenced = false)
        delay(5000); onDone()
    }
    if (phase != "blocked") IncomingCall("(201) 266-3840") {
        AnimatedVisibility(phase == "checking", enter = fadeIn() + slideInVertically()) { CanaryPill("CallCanary · checking the number…", busy = true) }
    } else Column(Modifier.fillMaxSize().background(AlarmBackground).safeDrawingPadding().padding(start = 24.dp, end = 24.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
        Box(Modifier.size(110.dp).background(Red, CircleShape).border(4.dp, Color.White, CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Block, contentDescription = null, tint = Color.White, modifier = Modifier.size(64.dp))
        }
        Text("Blocked before it rang", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
        Text("(201) 266-3840", color = Color(0xFFFFE08A), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(reason, color = Color.White, fontSize = 19.sp, textAlign = TextAlign.Center)
        Text("Your phone stayed quiet. CallCanary added it to your blocked list.", color = Color.White.copy(alpha = 0.85f), fontSize = 17.sp, textAlign = TextAlign.Center)
    }
}

// ───────────────────────── 5. Live call protection ─────────────────────────

private const val BANK_CALL = "Hi, this is Mark from the fraud department at your bank. We stopped a suspicious charge of nine hundred dollars on your card. To cancel it, I'm texting you a verification code right now. Please read me the code as soon as you get it. Don't hang up, and don't call the bank yourself, the lines are busy. We have to do this now or the money will be gone."
// Where each warning phrase appears in the script (word index), matching the website's phrase scoring.
private val bankSignals = listOf(Triple(11, "Claims to be your bank", 15), Triple(39, "Asks for codes", 35), Triple(48, "Pressure to act now", 15))

@Composable
fun LiveCallScene(store: Store, onDone: () -> Unit) {
    val context = LocalContext.current
    var phase by remember { mutableStateOf("ringing") } // ringing, answering, active, checking, alert, blocking, blocked
    var words by remember { mutableIntStateOf(0) }
    var seconds by remember { mutableIntStateOf(0) }
    var speaking by remember { mutableStateOf(false) }
    val all = remember { BANK_CALL.split(" ") }
    LaunchedEffect(phase) { if (phase == "active" || phase == "checking") while (true) { delay(1000); seconds++ } }
    LaunchedEffect(Unit) {
        delay(2400); phase = "answering"; delay(500); phase = "active"
        // The caller speaks; CallCanary cuts them off once the AI confirms the scam.
        playClip(context, R.raw.caller_bank, fallbackMs = 16000, stopAt = 0.72f) { p ->
            words = ceil(all.size * p * 1.04).toInt().coerceAtMost(all.size)
            if (words >= 39 && phase == "active") phase = "checking"
        }
        phase = "alert"; speaking = true
        playClip(context, R.raw.canary_live_warning, fallbackMs = 9000)
        speaking = false; delay(1400); phase = "blocking"; delay(900); phase = "blocked"
        store.block("5125550187", "Bank impersonation: asked for your verification code")
        store.addEvent("call", "Blocked (512) 555-0187 during a call", "Pretended to be your bank and asked for your code", blocked = true)
        delay(3500); onDone()
    }
    when (phase) {
        "ringing", "answering" -> IncomingCall("(512) 555-0187", accept = phase == "answering")
        "active", "checking" -> InCall(words, all, seconds, checking = phase == "checking")
        "alert", "blocking" -> LiveAlert(speaking, pressed = phase == "blocking")
        else -> BlockedNumber("(512) 555-0187", "This number can't call you again. CallCanary added it to your blocked list.")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InCall(words: Int, all: List<String>, seconds: Int, checking: Boolean) {
    val caption = all.take(words).joinToString(" ")
    val signals = bankSignals.filter { words >= it.first }
    val score by animateFloatAsState(signals.sumOf { it.third } / 100f, label = "score")
    Column(Modifier.fillMaxSize().background(CallBackground).safeDrawingPadding().padding(start = 20.dp, end = 20.dp, top = 40.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.AccountCircle, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(60.dp))
        Text("Unknown", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Text("(512) 555-0187 · mobile", color = Color.White.copy(alpha = 0.7f), fontSize = 16.sp)
        Text("%d:%02d".format(seconds / 60, seconds % 60), color = Color.White.copy(alpha = 0.6f), fontSize = 15.sp)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.1f), RoundedCornerShape(20.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(26.dp).background(CC.Lamp, RoundedCornerShape(7.dp)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Shield, contentDescription = null, tint = CC.Coal, modifier = Modifier.size(16.dp))
                }
                Text(if (checking) "CallCanary · checking with AI" else "CallCanary · listening", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
                if (checking) LinearProgressIndicator(Modifier.width(44.dp), color = CC.Lamp, trackColor = Color.White.copy(alpha = 0.2f))
                else Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
                    listOf(700, 520, 640, 460, 580).forEach { ms -> Box(Modifier.width(4.dp).height((18 * pulse(0.3f, 1f, ms)).dp).background(Green, RoundedCornerShape(2.dp))) }
                }
            }
            Text(if (caption.isEmpty()) "Waiting for the caller to speak…" else "“…${caption.takeLast(150)}”", color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp, lineHeight = 22.sp, maxLines = 3)
            Box(Modifier.fillMaxWidth().height(8.dp).background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(4.dp))) {
                Box(Modifier.fillMaxWidth(score.coerceAtLeast(0.04f)).height(8.dp).background(if (score >= 0.35f) Red else if (score > 0f) Color(0xFFFFCC00) else Green, RoundedCornerShape(4.dp)))
            }
            // Chips wrap onto a new line instead of squeezing.
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                signals.forEach { (_, label, weight) ->
                    Text("$label +$weight", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.background(Red.copy(alpha = 0.85f), RoundedCornerShape(10.dp)).padding(horizontal = 8.dp, vertical = 3.dp))
                }
            }
        }
        Spacer(Modifier.weight(1f))
        val buttons = listOf(Icons.Filled.MicOff to "mute", Icons.Filled.Dialpad to "keypad", Icons.Filled.VolumeUp to "speaker", Icons.Filled.PersonAdd to "add call", Icons.Filled.Videocam to "video", Icons.Filled.Contacts to "contacts")
        buttons.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                row.forEach { (icon, label) ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(62.dp).background(if (label == "speaker") Color.White else Color.White.copy(alpha = 0.15f), CircleShape), contentAlignment = Alignment.Center) {
                            Icon(icon, contentDescription = label, tint = if (label == "speaker") Color.Black else Color.White, modifier = Modifier.size(28.dp))
                        }
                        Text(label, color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
                    }
                }
            }
        }
        Box(Modifier.padding(top = 10.dp).size(70.dp).background(Red, CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.CallEnd, contentDescription = "End call", tint = Color.White, modifier = Modifier.size(34.dp))
        }
    }
}

@Composable
private fun LiveAlert(speaking: Boolean, pressed: Boolean) {
    Column(Modifier.fillMaxSize().background(AlarmBackground).safeDrawingPadding().padding(start = 22.dp, end = 22.dp, top = 40.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.scale(if (speaking) pulse(0.96f, 1.06f, 350) else 1f)) { Mascot(awake = true, size = 130.dp) }
        Text("CALLCANARY ALERT", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 2.sp,
            modifier = Modifier.background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 4.dp))
        Text("SCAM CALL", color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.ExtraBold)
        Text("HANG UP NOW", color = Color(0xFFFFE08A), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
        listOf("The caller claims to be from your bank to trick you into trusting them.", "They are asking you to read them a secret verification code over the phone.").forEach {
            Row(Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(14.dp)).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Warning, contentDescription = null, tint = Color(0xFFFFE08A), modifier = Modifier.size(22.dp)); Text(it, color = Color.White, fontSize = 17.sp)
            }
        }
        Text(if (speaking) "🔊 CallCanary is explaining…" else "Don't read them any code.", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.weight(1f))
        Box(Modifier.scale(if (pressed) 0.94f else if (!speaking) pulse(1f, 1.04f) else 1f).fillMaxWidth().background(Color.White, RoundedCornerShape(20.dp)).padding(20.dp), contentAlignment = Alignment.Center) {
            Text(if (pressed) "Hanging up & blocking…" else "Hang up & block", color = CC.Danger, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
private fun BlockedNumber(number: String, detail: String) {
    Column(Modifier.fillMaxSize().background(CoalBackground).safeDrawingPadding().padding(start = 24.dp, end = 24.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically)) {
        Box(Modifier.size(110.dp).background(Red, CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Block, contentDescription = null, tint = Color.White, modifier = Modifier.size(64.dp))
        }
        Text("Call ended", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold)
        Text("$number is blocked", color = Color(0xFFFFE08A), fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(detail, color = Color.White.copy(alpha = 0.85f), fontSize = 18.sp, textAlign = TextAlign.Center)
    }
}

// ───────────────────────── 6. AI call screener ─────────────────────────

private const val GREETING = "Hello, this is CallCanary, an automated assistant answering this call. Please say your name and why you're calling, then pause."
private const val IRS_CALL = "Hello, this is Officer Daniels with the IRS. There's a warrant out for your arrest over unpaid taxes. You need to pay today with Apple gift cards, and do not tell anyone about this call."
private val screenerChecks = listOf(
    Triple("Reported-number list", "Not in FTC complaints. That doesn't prove it's safe.", true),
    Triple("What the caller said", "“Officer Daniels with the IRS… pay today with Apple gift cards…”", true),
    Triple("Warning phrases", "Gift-card payment, threat of arrest, keep it secret", false),
    Triple("Trusted contacts", "The caller didn't give the name of a saved contact.", true),
    Triple("CallCanary's judgment", "A classic IRS impersonation scam: real agencies never demand gift cards.", false),
)

@Composable
fun ScreenerScene(store: Store, onDone: () -> Unit) {
    val context = LocalContext.current
    var phase by remember { mutableStateOf("ringing") } // ringing, greeting, listening, checking, verdict, goodbye, blocked
    var caption by remember { mutableStateOf("") }
    var checks by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) {
        delay(2000); phase = "greeting"
        val greet = GREETING.split(" ")
        playClip(context, R.raw.canary_greeting, fallbackMs = 7000) { p -> caption = greet.take(ceil(greet.size * p * 1.05).toInt()).joinToString(" ") }
        phase = "listening"; caption = ""
        val said = IRS_CALL.split(" ")
        playClip(context, R.raw.caller_irs, fallbackMs = 10000) { p -> caption = said.take(ceil(said.size * p * 1.05).toInt()).joinToString(" ") }
        phase = "checking"
        for (i in 1..screenerChecks.size) { checks = i; delay(650) }
        phase = "verdict"; delay(2800)
        phase = "goodbye"; playClip(context, R.raw.canary_goodbye, fallbackMs = 4000)
        phase = "blocked"
        store.block("4155550142", "Screened: IRS impersonation demanding gift cards")
        store.addEvent("call", "Screened and blocked (415) 555-0142", "“Officer Daniels” demanded gift cards", blocked = true)
        delay(3500); onDone()
    }
    if (phase == "ringing") { IncomingCall("(415) 555-0142", screenButton = true); return }
    if (phase == "blocked") { BlockedNumber("(415) 555-0142", "“Officer Daniels” never reached you. CallCanary added the number to your blocked list."); return }
    val scam = phase == "verdict" || phase == "goodbye"
    val ring = when (phase) { "greeting", "goodbye" -> CC.Lamp; "listening" -> Green; "checking" -> Color(0xFFFFCC00); else -> Red }
    Column(Modifier.fillMaxSize().background(CoalBackground).safeDrawingPadding().padding(start = 20.dp, end = 20.dp, top = 56.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("CALLCANARY CALL SCREEN · (415) 555-0142", color = Color(0xFFB9C8B4), fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Text(if (scam) "“Officer Daniels”" else when (phase) { "greeting" -> "CallCanary answered"; "listening" -> "Listening to the caller…"; else -> "Checking what they said…" },
            color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
        if (scam) Text("This sounds like a scam", color = Color(0xFFFFB4AE), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
        Box(Modifier.size(150.dp).border(8.dp, ring, CircleShape).padding(14.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.scale(if (phase == "greeting" || phase == "goodbye") pulse(0.95f, 1.06f, 350) else 1f)) { Mascot(awake = true, size = 108.dp) }
        }
        if (phase == "greeting" || phase == "listening" || phase == "goodbye") Text(buildAnnotatedString {
            withStyle(SpanStyle(color = CC.Lamp, fontWeight = FontWeight.Bold)) { append(if (phase == "listening") "Caller: " else "CallCanary: ") }
            append(if (phase == "goodbye") "Thank you. The person you're calling isn't available right now. Goodbye." else caption)
        }, color = Color.White, fontSize = 17.sp, lineHeight = 23.sp, modifier = Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.25f), RoundedCornerShape(16.dp)).padding(14.dp))
        if (phase == "checking" || phase == "verdict") Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            screenerChecks.take(checks).forEachIndexed { i, (label, detail, ok) ->
                val decided = scam && i == screenerChecks.lastIndex
                Row(Modifier.fillMaxWidth().background(if (decided) Color(0x33F4CF47) else Color.Black.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                    .then(if (decided) Modifier.border(2.dp, CC.Lamp, RoundedCornerShape(12.dp)) else Modifier).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(if (i == 3) Icons.Filled.RemoveCircle else if (ok) Icons.Filled.CheckCircle else Icons.Filled.Cancel, contentDescription = null,
                        tint = if (i == 3) Color.White.copy(alpha = 0.5f) else if (ok) Color(0xFF5BE08A) else Color(0xFFFF6B61), modifier = Modifier.size(22.dp))
                    Column {
                        Text(label + if (decided) "  · DECIDED" else "", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(detail, color = Color.White.copy(alpha = 0.75f), fontSize = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}

// ───────────────────────── 7. Summary ─────────────────────────

@Composable
fun SummaryScene(store: Store, onDone: () -> Unit) {
    val events = remember { store.events() }
    val stats = listOf(
        "Scam calls blocked" to events.count { it.kind == "call" && it.blocked },
        "Scam websites blocked" to events.count { it.kind == "web" },
        "Phishing emails caught" to events.filter { it.kind == "email" }.size * 2,
        "Scam texts flagged" to events.count { it.kind == "text" },
    )
    LaunchedEffect(Unit) { delay(8000); onDone() }
    Column(Modifier.fillMaxSize().background(CoalBackground).safeDrawingPadding().padding(start = 18.dp, end = 18.dp, top = 56.dp, bottom = CAPTION_SPACE.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Mascot(awake = true, size = 120.dp)
        Text("You're protected", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold)
        Text("Today, CallCanary stopped:", color = Color(0xFFD6E2D0), fontSize = 18.sp)
        stats.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEachIndexed { i, (label, value) ->
                    val shown by animateFloatAsState(value.toFloat(), tween(1200, delayMillis = 300 + i * 200), label = "count")
                    Column(Modifier.weight(1f).background(Color.White, RoundedCornerShape(20.dp)).padding(16.dp)) {
                        Text("${shown.toInt()}", fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, color = CC.Ink)
                        Text(label, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = CC.Muted)
                    }
                }
            }
        }
        Text("Blocked numbers: " + store.blocked().take(4).joinToString(", ") { com.callcanary.app.data.PhoneNumbers.format(it.number) }, color = Color.White.copy(alpha = 0.8f), fontSize = 15.sp, textAlign = TextAlign.Center)
    }
}
