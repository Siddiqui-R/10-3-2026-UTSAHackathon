package com.callcanary.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.callcanary.app.data.CheckApi
import com.callcanary.app.data.PhoneNumbers
import com.callcanary.app.data.ReportedNumbers
import com.callcanary.app.data.Store
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
private fun Section(content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(2.dp, Color(0xFFDCE3DC))) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}
private fun time(at: Long) = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(at))

@Composable
fun HomeScreen(screeningOn: Boolean, notificationsOn: Boolean, store: Store, refresh: Int, onTurnOn: () -> Unit, onNotifications: () -> Unit, onCheck: () -> Unit) {
    val events = remember(refresh) { store.events() }
    val blockedCalls = events.count { it.kind == "call" && it.blocked }
    val context = androidx.compose.ui.platform.LocalContext.current
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Your canary in the coal mine", if (screeningOn) "You're protected" else "Protection is off",
            if (screeningOn) "CallCanary checks every call from a number that isn't in your contacts." else "Turn on call screening so CallCanary can stop scam calls before your phone rings.") {
            Mascot(awake = screeningOn)
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            if (!screeningOn) BigButton("Turn on call screening", onTurnOn, color = CC.Lamp, textColor = CC.Coal)
            if (!notificationsOn) BigButton("Allow notifications", onNotifications, color = Color.White, textColor = CC.Pine)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Stat("Scam calls stopped", blockedCalls, Modifier.weight(1f))
                Stat("Numbers you blocked", store.blocked().size, Modifier.weight(1f))
            }
            BigButton("Protect a call I'm on", { context.startActivity(com.callcanary.app.listen.ListenActivity.intent(context, null, autoStart = false)) }, color = CC.Coal)
            BigButton("Check a link, text or email", onCheck)
            Section {
                Text("Recent activity", style = MaterialTheme.typography.titleLarge)
                if (events.isEmpty()) Text("Nothing yet. Blocked calls and checks will show up here.", color = CC.Muted)
                events.take(15).forEach { e ->
                    Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(if (e.blocked) Icons.Filled.Warning else Icons.Filled.CheckCircle, contentDescription = if (e.blocked) "Blocked" else "Allowed",
                            tint = if (e.blocked) CC.Danger else CC.Safe, modifier = Modifier.size(26.dp))
                        Column(Modifier.weight(1f)) {
                            Text(e.title, fontWeight = FontWeight.Bold)
                            Text(e.detail, color = CC.Muted, style = MaterialTheme.typography.bodyMedium)
                        }
                        Text(time(e.at), color = CC.Muted, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: Int, modifier: Modifier) {
    Card(modifier, shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = BorderStroke(2.dp, Color(0xFFDCE3DC))) {
        Column(Modifier.padding(16.dp)) {
            Text("$value", fontSize = 40.sp, fontWeight = FontWeight.ExtraBold, color = CC.Ink)
            Text(label, color = CC.Muted, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
    }
}

/** Paste or share anything; the real checker answers. */
@Composable
fun CheckScreen(initial: String = "", autoRun: Boolean = false, store: Store) {
    var text by rememberSaveable { mutableStateOf(initial) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<CheckApi.Result?>(null) }
    val scope = rememberCoroutineScope()
    fun run() {
        if (text.isBlank() || busy) return
        busy = true; error = null; result = null
        scope.launch {
            try {
                val r = CheckApi.check(text); result = r
                store.addEvent("check", "Checked: ${verdictTitle(r.level)}", text.trim().replace(Regex("\\s+"), " ").take(80), blocked = r.level != "safe")
            } catch (e: CheckApi.CheckException) { error = e.message }
            busy = false
        }
    }
    LaunchedEffect(Unit) { if (autoRun && initial.isNotBlank()) run() }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Got a strange message?", "Check it before you click", "Share a link, text or email to CallCanary, or paste it here.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            OutlinedTextField(text, { text = it }, label = { Text("Link, text or email") }, minLines = 4, modifier = Modifier.fillMaxWidth(),
                textStyle = MaterialTheme.typography.bodyLarge, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text))
            BigButton(if (busy) "Checking…" else "Check it", ::run, color = CC.Lamp, textColor = CC.Coal, enabled = !busy && text.isNotBlank())
            if (busy) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                CircularProgressIndicator(Modifier.size(28.dp), color = CC.Pine); Text("CallCanary is reading it carefully…")
            }
            error?.let { Text(it, color = CC.Danger, fontWeight = FontWeight.Bold) }
            result?.let { CheckResult(it) }
        }
    }
}

private fun verdictTitle(level: String) = when (level) { "phishing" -> "Scam"; "suspicious" -> "Be careful"; else -> "Looks safe" }

@Composable
private fun CheckResult(r: CheckApi.Result) {
    val (bg, fg) = when (r.level) { "phishing" -> CC.Danger to Color.White; "suspicious" -> CC.WarnSoft to CC.Warn; else -> CC.SafeSoft to CC.Safe }
    Column(Modifier.fillMaxWidth().background(bg, RoundedCornerShape(24.dp)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Mascot(awake = true, size = 110.dp)
        Text(when (r.level) { "phishing" -> "SCAM — DON'T CLICK"; "suspicious" -> "Be careful"; else -> "This looks safe" },
            color = fg, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
        if (r.recommendedAction.isNotBlank()) Text(r.recommendedAction, color = fg, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
        Text("Risk ${r.riskScore}/100", color = fg, fontWeight = FontWeight.Bold)
        if (!r.aiChecked) Text("The AI check wasn't available, so this comes from the link checks only.", color = fg, textAlign = TextAlign.Center)
    }
    if (r.links.isNotEmpty()) Section {
        Text("Link check", style = MaterialTheme.typography.titleLarge)
        r.links.forEach { l ->
            val bad = l.verdict != "safe"
            Column(Modifier.fillMaxWidth().background(if (bad) CC.DangerSoft else CC.SafeSoft, RoundedCornerShape(16.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(buildAnnotatedString { append("Says: "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(l.shown) } })
                Text(buildAnnotatedString { append("Actually goes to: "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = if (bad) CC.Danger else CC.Safe)) { append(l.actualDomain) } })
                Text(when (l.verdict) { "malicious" -> "DANGEROUS — DON'T CLICK"; "suspicious" -> "SUSPICIOUS"; else -> "LOOKS OKAY" }, fontWeight = FontWeight.ExtraBold, color = if (bad) CC.Danger else CC.Safe, fontSize = 15.sp)
                Text(l.explanation, color = CC.Muted, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
    if (r.typos.isNotEmpty()) Section {
        Text("Spelling mistakes found", style = MaterialTheme.typography.titleLarge)
        r.typos.forEach { t ->
            Text(buildAnnotatedString {
                withStyle(SpanStyle(color = CC.Danger, textDecoration = TextDecoration.LineThrough)) { append(t.typo) }
                append("  →  "); withStyle(SpanStyle(color = CC.Safe, fontWeight = FontWeight.Bold)) { append(t.correction) }
            }, fontSize = 22.sp)
        }
        Text("Real companies proofread. Spelling mistakes are a warning sign.", color = CC.Muted)
    }
    r.sender?.takeIf { it.address.contains("@") }?.let { s -> Section {
        Text("Sender check", style = MaterialTheme.typography.titleLarge)
        Text("Claims to be: ${s.claimedBrand.ifBlank { s.displayName }}")
        Text(buildAnnotatedString { append("Actually sent from: "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = if (s.spoofed) CC.Danger else CC.Safe)) { append(s.address) } })
        if (s.spoofed) Text("FAKE SENDER", color = CC.Danger, fontWeight = FontWeight.ExtraBold)
        Text(s.explanation, color = CC.Muted, style = MaterialTheme.typography.bodyMedium)
    } }
    if (r.pressureTactics.isNotEmpty()) Section {
        Text("Pressure tricks used", style = MaterialTheme.typography.titleLarge)
        r.pressureTactics.forEach { Text("• $it") }
    }
}

/** Hook CallCanary up to your calls and your Gmail. */
@Composable
fun ConnectScreen(screeningOn: Boolean, notificationsOn: Boolean, messagesOn: Boolean, gmailAccount: String?, onAllowCalls: () -> Unit, onNotifications: () -> Unit,
                  onAllowMessages: () -> Unit, onConnectGmail: () -> Unit, onDisconnectGmail: () -> Unit, onOpenGmail: () -> Unit) {
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Connect", "Let CallCanary watch out for you", "Give it access to your calls and connect your email.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Section {
                ConnectHeader("Phone calls", screeningOn)
                Text(if (screeningOn) "CallCanary checks every call from a number that isn't in your contacts and stops scam calls before your phone rings."
                    else "Allow CallCanary to screen your calls. Android will ask you to set it as your caller ID & spam app.", color = CC.Muted)
                if (!screeningOn) BigButton("Allow access to calls", onAllowCalls, color = CC.Lamp, textColor = CC.Coal)
            }
            Section {
                ConnectHeader("Texts & emails", messagesOn)
                Text(if (messagesOn) "CallCanary checks every new text and email the moment it arrives, on this phone, and warns you about scams."
                    else "Let CallCanary read new message notifications (Messages, Gmail, Outlook, WhatsApp) so it can warn you about scam texts and emails right away. Nothing is uploaded.", color = CC.Muted)
                if (!messagesOn) BigButton("Allow access to messages", onAllowMessages, color = CC.Lamp, textColor = CC.Coal)
            }
            Section {
                ConnectHeader("Gmail", gmailAccount != null)
                if (gmailAccount == null) {
                    Text("Connect your Gmail account so CallCanary can help you spot fake emails.", color = CC.Muted)
                    BigButton("Connect Gmail", onConnectGmail, color = CC.Lamp, textColor = CC.Coal)
                } else {
                    Text(buildAnnotatedString { append("Connected as "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(gmailAccount) } })
                    Text("To check an email, select its text in Gmail and tap \"Check with CallCanary\", or share it to CallCanary.", color = CC.Muted)
                    BigButton("Open Gmail", onOpenGmail)
                    BigButton("Disconnect", onDisconnectGmail, color = Color.White, textColor = CC.Danger)
                }
            }
            Section {
                ConnectHeader("Notifications", notificationsOn)
                Text("Get a notice every time CallCanary blocks a call.", color = CC.Muted)
                if (!notificationsOn) BigButton("Allow notifications", onNotifications, color = Color.White, textColor = CC.Pine)
            }
        }
    }
}

@Composable
private fun ConnectHeader(title: String, on: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        Text(if (on) "Connected" else "Not connected", color = if (on) CC.Safe else CC.Muted, fontWeight = FontWeight.Bold,
            modifier = Modifier.background(if (on) CC.SafeSoft else Color(0xFFECEFEA), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 4.dp))
    }
}

@Composable
fun BlockedScreen(store: Store, refresh: Int, onChanged: () -> Unit) {
    var number by rememberSaveable { mutableStateOf("") }
    var problem by remember { mutableStateOf<String?>(null) }
    val blocked = remember(refresh) { store.blocked() }
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Your block list", "Blocked numbers", "Calls from these numbers are stopped before your phone rings.")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Section {
                OutlinedTextField(number, { number = it; problem = null }, label = { Text("Phone number") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    textStyle = MaterialTheme.typography.bodyLarge, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                problem?.let { Text(it, color = CC.Danger, fontWeight = FontWeight.Bold) }
                BigButton("Block this number", {
                    val digits = PhoneNumbers.normalizeUs(number)
                    if (digits == null) problem = "Enter a 10-digit US phone number."
                    else { store.block(digits, "Added by you"); store.addEvent("block", "Blocked ${PhoneNumbers.format(digits)}", "Added by you", blocked = true); number = ""; onChanged() }
                }, color = CC.Danger)
            }
            if (blocked.isEmpty()) Text("No numbers blocked yet. Scam numbers reported to the FTC are blocked automatically.", color = CC.Muted)
            blocked.forEach { b ->
                Section {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(PhoneNumbers.format(b.number), style = MaterialTheme.typography.titleLarge)
                            Text(b.reason, color = CC.Muted)
                        }
                        IconButton(onClick = { store.unblock(b.number); onChanged() }, modifier = Modifier.size(56.dp)) {
                            Icon(Icons.Filled.Delete, contentDescription = "Unblock ${PhoneNumbers.format(b.number)}", tint = CC.Danger, modifier = Modifier.size(30.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(store: Store, reported: ReportedNumbers?, refresh: Int, onChanged: () -> Unit, onClearHistory: () -> Unit) {
    Column(Modifier.verticalScroll(rememberScrollState())) {
        Hero("Settings", "How CallCanary protects you")
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            key(refresh) {
                Toggle("Block numbers reported to the FTC", "Uses the FTC's public Do Not Call complaint reports. Reported isn't proof, but these numbers are complained about a lot.", store.blockReported) { store.blockReported = it; onChanged() }
                Toggle("Silence instead of rejecting", "The call goes quietly to voicemail instead of being hung up.", store.silenceOnly) { store.silenceOnly = it; onChanged() }
                Toggle("Block hidden numbers", "Stop calls that hide their number.", store.blockHidden) { store.blockHidden = it; onChanged() }
                Toggle("Offer to listen to unknown callers", "When a number that isn't blocked calls, a notification lets you turn on live protection.", store.offerListening) { store.offerListening = it; onChanged() }
                Toggle("AI second opinion during calls", "When online, sends the words of a protected call (never the audio) to CallCanary's AI, which can catch scams the phrase list misses.", store.aiSecondOpinion) { store.aiSecondOpinion = it; onChanged() }
                Toggle("Say warnings out loud", "During a call on speaker, CallCanary says the scam warning so you can't miss it. The caller hears it too.", store.speakWarnings) { store.speakWarnings = it; onChanged() }
                Toggle("Save call recordings", "Keeps a recording and transcript of protected calls on this phone only. Tell the other person you're recording.", store.recordCalls) { store.recordCalls = it; onChanged() }
            }
            Section {
                Text("Scam number list", style = MaterialTheme.typography.titleLarge)
                Text(if (reported == null) "Loading…" else "${"%,d".format(reported.size)} numbers reported to the FTC between ${reported.from} and ${reported.to}. Works offline.", color = CC.Muted)
            }
            Section {
                Text("Privacy", style = MaterialTheme.typography.titleLarge)
                Text("Calls are checked on your phone; numbers are never uploaded. Links and texts you choose to check are sent to CallCanary's checker. Your contacts' calls are never screened.", color = CC.Muted)
            }
            BigButton("Clear recent activity", onClearHistory, color = Color.White, textColor = CC.Danger)
        }
    }
}

@Composable
private fun key(refresh: Int, content: @Composable () -> Unit) = androidx.compose.runtime.key(refresh) { content() }

@Composable
private fun Toggle(title: String, detail: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Section {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleLarge)
                Text(detail, color = CC.Muted, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.width(12.dp))
            Switch(checked = checked, onCheckedChange = onChange)
        }
    }
}
