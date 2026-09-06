package app.two.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import app.two.android.core.security.BiometricAuthManager
import app.two.android.core.security.ExitSafeManager
import app.two.android.core.security.SecurityWindowManager
import app.two.android.core.theme.AppThemeMode
import app.two.android.core.theme.TwoTheme
import app.two.android.features.chat.ChatScreen
import app.two.android.features.decks.DecksScreen
import app.two.android.features.home.HomeScreen
import app.two.android.features.journal.JournalScreen
import app.two.android.features.lists.SharedListsScreen
import app.two.android.features.memory.TimelineScreen
import app.two.android.features.onboarding.*
import app.two.android.features.repair.RepairKitScreen
import app.two.android.features.settings.ConsentAuditLogScreen
import app.two.android.features.settings.SettingsScreen
import kotlinx.coroutines.launch

enum class Screen {
    PASSPHRASE,
    RECOVERY_PHRASE,
    PAIRING,
    SAFETY_NUMBER,
    HOME,
    CHAT,
    DECKS,
    JOURNAL,
    REPAIR_KIT,
    LISTS,
    MEMORIES,
    SETTINGS,
    AUDIT_LOG
}

class MainActivity : FragmentActivity() {

    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var exitSafeManager: ExitSafeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Enable FLAG_SECURE to prevent screenshots and task-switcher previews
        SecurityWindowManager.applyWindowProtection(this, true)

        biometricAuthManager = BiometricAuthManager(this)
        val app = application as TwoApplication
        exitSafeManager = ExitSafeManager(this, app.database, app.keystoreManager)

        setContent {
            TwoTheme(themeMode = AppThemeMode.WARM_LINEN) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    app.two.android.features.web.TwoWebView()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        biometricAuthManager.onAppBackgrounded()
    }
}
