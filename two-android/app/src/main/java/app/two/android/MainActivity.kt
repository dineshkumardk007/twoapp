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
            var currentTheme by remember { mutableStateOf(AppThemeMode.WARM_LINEN) }
            var currentScreen by remember { mutableStateOf(Screen.HOME) }
            val scope = rememberCoroutineScope()

            TwoTheme(themeMode = currentTheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    when (currentScreen) {
                        Screen.PASSPHRASE -> PassphraseScreen(
                            onPassphraseConfirmed = { currentScreen = Screen.RECOVERY_PHRASE }
                        )

                        Screen.RECOVERY_PHRASE -> RecoveryPhraseScreen(
                            onConfirmed = { currentScreen = Screen.PAIRING }
                        )

                        Screen.PAIRING -> PairingScreen(
                            userPublicKeyHex = "A1F2C84...",
                            onPairingCompleted = { currentScreen = Screen.SAFETY_NUMBER }
                        )

                        Screen.SAFETY_NUMBER -> SafetyNumberScreen(
                            userPublicKey = ByteArray(32) { 0x01 },
                            partnerPublicKey = ByteArray(32) { 0x02 },
                            onVerified = { currentScreen = Screen.HOME }
                        )

                        Screen.HOME -> HomeScreen(
                            onNavigateToChat = { currentScreen = Screen.CHAT },
                            onNavigateToDecks = { currentScreen = Screen.DECKS },
                            onNavigateToJournal = { currentScreen = Screen.JOURNAL },
                            onNavigateToRepair = { currentScreen = Screen.REPAIR_KIT },
                            onNavigateToNeeds = { currentScreen = Screen.CHAT },
                            onNavigateToMemories = { currentScreen = Screen.MEMORIES },
                            onNavigateToSettings = { currentScreen = Screen.SETTINGS },
                            onEmergencyQuickExit = {
                                scope.launch {
                                    exitSafeManager.executeSilentWipe()
                                    finishAffinity()
                                }
                            }
                        )

                        Screen.CHAT -> ChatScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.DECKS -> DecksScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.JOURNAL -> JournalScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.REPAIR_KIT -> RepairKitScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.LISTS -> SharedListsScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.MEMORIES -> TimelineScreen(
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.SETTINGS -> SettingsScreen(
                            currentTheme = currentTheme,
                            onThemeSelected = { currentTheme = it },
                            onNavigateToAuditLog = { currentScreen = Screen.AUDIT_LOG },
                            onNavigateToExport = { currentScreen = Screen.HOME },
                            onEmergencyQuickExit = {
                                scope.launch {
                                    exitSafeManager.executeSilentWipe()
                                    finishAffinity()
                                }
                            },
                            onBack = { currentScreen = Screen.HOME }
                        )

                        Screen.AUDIT_LOG -> ConsentAuditLogScreen(
                            onBack = { currentScreen = Screen.SETTINGS }
                        )
                    }
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        biometricAuthManager.onAppBackgrounded()
    }
}
