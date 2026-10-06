package app.two.android

import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
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
import app.two.android.core.theme.LinenBackground
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
import app.two.android.features.web.TwoWebView
import app.two.android.features.web.WebReady
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
        // The launch screen - the leaf on linen - has to be installed before
        // the activity is created, and it then stays up until the page says it
        // has drawn its first real screen (WebReady, set over the bridge). The
        // time limit is a safety net: a page that never reports in, or a slow
        // phone, still gets its blank-then-app start rather than a leaf that
        // never goes away.
        val launchedAt = SystemClock.uptimeMillis()
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        splashScreen.setKeepOnScreenCondition {
            !WebReady.ready && SystemClock.uptimeMillis() - launchedAt < SPLASH_MAX_MS
        }

        // Draw behind the status and gesture bars. The web layer positions its
        // dock with env(safe-area-inset-bottom), which only resolves to a real
        // value when the WebView actually extends under the system bars.
        //
        // Both bars are told outright that they sit on a light background.
        // Left to decide for itself, Android picks white icons whenever the
        // phone is in dark mode - and Two is always light, so the clock,
        // battery and gesture handle turned white on cream and disappeared.
        // The status bar stays clear over the linen behind it; the navigation
        // bar gets the same linen, so three-button phones show the buttons on
        // the app's own colour rather than a grey scrim.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(LINEN_BACKGROUND_ARGB, LINEN_BACKGROUND_ARGB)
        )
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // 1. Enable FLAG_SECURE to prevent screenshots and task-switcher previews
        SecurityWindowManager.applyWindowProtection(this, true)

        biometricAuthManager = BiometricAuthManager(this)
        val app = application as TwoApplication
        exitSafeManager = ExitSafeManager(this, app.database, app.keystoreManager)

        setContent {
            TwoTheme(themeMode = AppThemeMode.WARM_LINEN) {
                // The strips above and below the WebView - behind the status
                // bar, the gesture bar and the keyboard - are this Surface.
                // Its default colour is the theme's white card surface, which
                // showed as white bands around the cream page; it is the page's
                // own background colour now.
                Surface(modifier = Modifier.fillMaxSize(), color = LinenBackground) {
                    TwoWebView()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        biometricAuthManager.onAppBackgrounded()
    }

    private companion object {
        /** Longest the launch screen waits for the page, in milliseconds. */
        const val SPLASH_MAX_MS = 2_500L

        /** #FAF8F5, the linen background, as a platform colour for the system bars. */
        const val LINEN_BACKGROUND_ARGB = 0xFFFAF8F5.toInt()
    }
}
