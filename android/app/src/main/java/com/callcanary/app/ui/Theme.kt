package com.callcanary.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.callcanary.app.R

// The website's identity: a coal-mine band lit by a canary lamp, meadow paper below.
object CC {
    val Coal = Color(0xFF0C1F16)
    val Coal2 = Color(0xFF163126)
    val Lamp = Color(0xFFF4CF47)
    val Paper = Color(0xFFF3F5EE)
    val Pine = Color(0xFF145C3A)
    val Ink = Color(0xFF15231D)
    val Muted = Color(0xFF53605A)
    val Danger = Color(0xFFB3141B)
    val DangerSoft = Color(0xFFFFF0F0)
    val Safe = Color(0xFF1F7A45)
    val SafeSoft = Color(0xFFE3F3E7)
    val Warn = Color(0xFF8A5A00)
    val WarnSoft = Color(0xFFFFF4C7)
}

// Large type throughout: the app is built for older users.
private val typography = Typography(
    headlineLarge = TextStyle(fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.ExtraBold),
    headlineMedium = TextStyle(fontSize = 28.sp, lineHeight = 32.sp, fontWeight = FontWeight.ExtraBold),
    titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 19.sp, lineHeight = 27.sp),
    bodyMedium = TextStyle(fontSize = 17.sp, lineHeight = 24.sp),
    labelLarge = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold),
)

@Composable
fun CallCanaryTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = CC.Pine, onPrimary = Color.White, secondary = CC.Lamp, onSecondary = CC.Coal,
            background = CC.Paper, onBackground = CC.Ink, surface = Color.White, onSurface = CC.Ink,
            error = CC.Danger, outline = Color(0xFFD3DBD4),
        ),
        typography = typography, content = content,
    )
}

/** The coal band with the lamp glow at the top of each screen. */
@Composable
fun Hero(eyebrow: String, title: String, subtitle: String? = null, content: @Composable () -> Unit = {}) {
    Box(
        Modifier.fillMaxWidth()
            .background(Brush.verticalGradient(listOf(CC.Coal2, CC.Coal)))
            .background(Brush.radialGradient(listOf(CC.Lamp.copy(alpha = 0.38f), Color.Transparent), center = Offset(540f, -40f), radius = 900f))
            .padding(horizontal = 20.dp, vertical = 24.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(eyebrow.uppercase(), color = CC.Lamp, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, textAlign = TextAlign.Center)
            Text(title, color = Color.White, style = MaterialTheme.typography.headlineLarge, textAlign = TextAlign.Center)
            if (subtitle != null) Text(subtitle, color = Color(0xFFD6E2D0), style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
            content()
        }
    }
}

@Composable
fun Mascot(awake: Boolean, size: Dp = 140.dp) {
    Image(painterResource(if (awake) R.drawable.mascot_awake else R.drawable.mascot_sleep),
        contentDescription = if (awake) "CallCanary awake and protecting you" else "CallCanary asleep, protection is off", modifier = Modifier.size(size))
}

/** 64dp-tall buttons with large text. */
@Composable
fun BigButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = CC.Pine, textColor: Color = Color.White, enabled: Boolean = true) {
    Button(onClick = onClick, enabled = enabled, modifier = modifier.fillMaxWidth().padding(vertical = 2.dp).clip(RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = color, contentColor = textColor),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 18.dp, horizontal = 20.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}
