package app.two.android

import android.content.Intent
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
import app.two.android.features.sync.NewMessageNotice
import app.two.android.features.sync.PageHost
import app.two.android.features.web.SmoothDisplay
import app.two.android.features.web.SystemChrome
import app.two.android.features.web.TwoWebView
import app.two.android.features.web.WebReady
import app.two.android.features.widget.LaunchAction
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

    private lateinit var exitSafeManager: ExitSafeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        // The launch screen - the two circles on the night sky - has to be installed before
        // the activity is created, and it then stays up until the page says it
        // has drawn its first real screen (WebReady, set over the bridge). The
        // time limit is a safety net: a page that never reports in, or a slow
        // phone, still gets its blank-then-app start rather than a mark that
        // never goes away.
        val launchedAt = SystemClock.uptimeMillis()
        WebReady.reset()
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        splashScreen.setKeepOnScreenCondition {
            !WebReady.ready && SystemClock.uptimeMillis() - launchedAt < SPLASH_MAX_MS
        }

        // Draw behind the status and gesture bars. The web layer positions its
        // dock with env(safe-area-inset-bottom), which only resolves to a real
        // value when the WebView actually extends under the system bars.
        //
        // Both bars are told outright that they sit on the night sky, so the
        // clock, battery and gesture handle are light whatever the phone's own
        // dark mode says. The status bar stays clear over the page; the
        // navigation bar gets the sky's colour, so three-button phones show
        // the buttons on the app rather than a grey scrim. A page in Aurora's
        // day version switches both over (SystemChrome, setBarsLight).
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(SystemChrome.NIGHT_ARGB)
        )
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // 1. Enable FLAG_SECURE to prevent screenshots and task-switcher previews
        SecurityWindowManager.applyWindowProtection(this, true)

        val app = application as TwoApplication
        exitSafeManager = ExitSafeManager(this, app.database, app.keystoreManager)

        // Opened from the home-screen widget to do something (LaunchAction).
        // Only on a real start: an activity recreated for a new font size
        // still carries the intent it started with.
        if (savedInstanceState == null) LaunchAction.offer(intent)

        setContent {
            TwoTheme(themeMode = AppThemeMode.WARM_LINEN) {
                // The strips above and below the WebView - behind the status
                // bar, the gesture bar and the keyboard - are this Surface.
                // Its default colour is the theme's white card surface, which
                // showed as white bands around the cream page; it is the page's
                // own background colour now, night or day as the page says.
                Surface(modifier = Modifier.fillMaxSize(), color = SystemChrome.background) {
                    TwoWebView()
                }
            }
        }
    }

    /**
     * The screen's fast refresh rate while Two is in front (SmoothDisplay).
     * On every return, so turning battery saver on or off is followed.
     */
    override fun onResume() {
        super.onResume()
        SmoothDisplay.apply(this)
        // Two is on screen: the "New message" notice has done its job.
        NewMessageNotice.cancel(this)
    }

    /**
     * Ended for good - swiped away, or closed by Android - rather than built
     * again for a new font size: the page has gone with it, and the
     * background listener answers in its place (features/sync).
     */
    override fun onDestroy() {
        if (!isChangingConfigurations) PageHost.activityGone(this)
        super.onDestroy()
    }

    /** The notification permission, asked for by the "New message" switch. */
    @Deprecated("Deprecated in Java")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == NewMessageNotice.ASK_CODE) NewMessageNotice.asked()
    }

    /** Brought forward by the widget while already open: the page asks when it shows. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        LaunchAction.offer(intent)
    }

    private companion object {
        /** Longest the launch screen waits for the page, in milliseconds. */
        const val SPLASH_MAX_MS = 2_500L

    }
}
