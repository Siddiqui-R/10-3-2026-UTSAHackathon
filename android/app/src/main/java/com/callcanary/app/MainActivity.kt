package com.callcanary.app

import android.Manifest
import android.accounts.AccountManager
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.callcanary.app.data.ReportedNumbers
import com.callcanary.app.data.Store
import com.callcanary.app.ui.BlockedScreen
import com.callcanary.app.ui.CC
import com.callcanary.app.ui.CallCanaryTheme
import com.callcanary.app.ui.ConnectScreen
import com.callcanary.app.ui.HomeScreen
import com.callcanary.app.ui.SettingsScreen
import com.callcanary.app.ui.demo.DemoStage
import com.callcanary.app.ui.demo.DemoTourScreen
import com.callcanary.app.ui.demo.Scene
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private var refresh by mutableIntStateOf(0)
    private var screeningOn by mutableStateOf(false)
    private var notificationsOn by mutableStateOf(false)
    private var messagesOn by mutableStateOf(false)
    private var reported by mutableStateOf<ReportedNumbers?>(null)
    private var gmailAccount by mutableStateOf<String?>(null)
    private lateinit var store: Store

    // Android asks the person to make CallCanary the call screening app.
    private val roleRequest = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { updateStatus() }
    private val notificationRequest = registerForActivityResult(ActivityResultContracts.RequestPermission()) { updateStatus() }
    // Android's own Google account picker; the chosen account is remembered on this phone.
    private val accountRequest = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)?.let { name ->
            store.gmailAccount = name; gmailAccount = name
            store.addEvent("connect", "Connected Gmail", name, blocked = false); refresh++
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Notifications.ensureChannel(this)
        // Load the FTC list now so the first screened call doesn't wait for it.
        lifecycleScope.launch { reported = withContext(Dispatchers.IO) { runCatching { ReportedNumbers.get(this@MainActivity) }.getOrNull() } }
        store = Store(this)
        gmailAccount = store.gmailAccount
        setContent {
            CallCanaryTheme {
                var tab by rememberSaveable { mutableStateOf(0) }
                // A playing demo takes over the whole screen; closing it returns to the app with updated counts.
                var demo by remember { mutableStateOf<List<Scene>?>(null) }
                demo?.let { scenes -> DemoStage(scenes, store) { demo = null; refresh++ }; return@CallCanaryTheme }
                Scaffold(containerColor = CC.Paper, bottomBar = {
                    NavigationBar(containerColor = CC.Coal) {
                        listOf("Home" to Icons.Filled.Home, "Connect" to Icons.Filled.Link, "Blocked" to Icons.Filled.Lock, "Demo" to Icons.Filled.PlayArrow, "Settings" to Icons.Filled.Settings).forEachIndexed { i, (label, icon) ->
                            NavigationBarItem(selected = tab == i, onClick = { tab = i; refresh++ }, icon = { Icon(icon, contentDescription = null) },
                                label = { Text(label, fontSize = 14.sp) },
                                colors = NavigationBarItemDefaults.colors(selectedIconColor = CC.Coal, selectedTextColor = CC.Lamp, indicatorColor = CC.Lamp,
                                    unselectedIconColor = Color(0xFFC9D6C4), unselectedTextColor = Color(0xFFC9D6C4)))
                        }
                    }
                }) { padding ->
                    val modifier = Modifier.fillMaxSize().padding(padding)
                    androidx.compose.foundation.layout.Box(modifier) {
                        when (tab) {
                            0 -> HomeScreen(screeningOn, notificationsOn, store, refresh, onTurnOn = ::requestScreening, onNotifications = ::requestNotifications, onCheck = { startActivity(Intent(this@MainActivity, CheckActivity::class.java)) })
                            1 -> ConnectScreen(screeningOn, notificationsOn, messagesOn, gmailAccount, onAllowCalls = ::requestScreening, onNotifications = ::requestNotifications,
                                onAllowMessages = { startActivity(Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) },
                                onConnectGmail = ::connectGmail, onDisconnectGmail = { store.gmailAccount = null; gmailAccount = null }, onOpenGmail = ::openGmail)
                            2 -> BlockedScreen(store, refresh) { refresh++ }
                            3 -> DemoTourScreen { demo = it }
                            else -> SettingsScreen(store, reported, refresh, onChanged = { refresh++ }, onClearHistory = { store.clearEvents(); refresh++ })
                        }
                    }
                }
            }
        }
    }

    override fun onResume() { super.onResume(); updateStatus() }

    private fun updateStatus() {
        screeningOn = getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        messagesOn = com.callcanary.app.messages.MessageWatcher.enabled(this)
        notificationsOn = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        refresh++
    }
    private fun requestScreening() {
        val roles = getSystemService(RoleManager::class.java)
        if (roles.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) roleRequest.launch(roles.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING))
    }
    private fun requestNotifications() = notificationRequest.launch(Manifest.permission.POST_NOTIFICATIONS)
    private fun connectGmail() = accountRequest.launch(AccountManager.newChooseAccountIntent(null, null, arrayOf("com.google"), null, null, null, null))
    private fun openGmail() {
        val gmail = packageManager.getLaunchIntentForPackage("com.google.android.gm")
        startActivity(gmail ?: Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://mail.google.com")))
    }

    companion object { fun open(from: android.content.Context) = from.startActivity(Intent(from, MainActivity::class.java)) }
}
