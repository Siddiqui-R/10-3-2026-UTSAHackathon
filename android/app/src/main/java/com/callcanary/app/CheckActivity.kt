package com.callcanary.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import com.callcanary.app.data.Store
import com.callcanary.app.ui.CallCanaryTheme
import com.callcanary.app.ui.CheckScreen

/** Opened from the share sheet ("Share → CallCanary") or the text-selection menu ("Check with CallCanary"). */
class CheckActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val text = when (intent?.action) {
            Intent.ACTION_SEND -> listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT)).joinToString("\n")
            Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString().orEmpty()
            else -> ""
        }
        val store = Store(this)
        setContent { CallCanaryTheme { Box(Modifier.fillMaxSize().safeDrawingPadding()) { CheckScreen(initial = text, autoRun = true, store = store) } } }
    }
}
