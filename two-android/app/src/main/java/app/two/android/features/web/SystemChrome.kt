package app.two.android.features.web

import android.app.Activity
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat

/**
 * The colours around the page: the strips behind the status bar, the gesture
 * bar and the keyboard, and the icons drawn on them.
 *
 * The page is Aurora's night sky unless the person chose its day version in
 * Settings, so these follow what the page says it is (setBarsLight on the
 * bridge) instead of being fixed - a night page with a cream strip above it,
 * or white clock icons on a light day page, would both look broken.
 */
object SystemChrome {
    /** The night sky, #0E0B1F. */
    val Night = Color(0xFF0E0B1F)

    /** The day version's lavender mist, #F7F5FF. */
    val Day = Color(0xFFF7F5FF)

    const val NIGHT_ARGB = 0xFF0E0B1F.toInt()
    const val DAY_ARGB = 0xFFF7F5FF.toInt()

    /** Whether the page is light right now. Night, the default, is not. */
    var light by mutableStateOf(false)
        private set

    val background: Color get() = if (light) Day else Night

    /** Called on the main thread when the page reports its look. */
    @Suppress("DEPRECATION")
    fun apply(activity: Activity, light: Boolean) {
        this.light = light
        val window = activity.window
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        // Dark icons on the day page, light icons on the night sky.
        controller.isAppearanceLightStatusBars = light
        controller.isAppearanceLightNavigationBars = light
        // Three-button navigation draws its own bar: the page's colour, so
        // the buttons sit on the app rather than on a band of the other look.
        window.navigationBarColor = if (light) DAY_ARGB else NIGHT_ARGB
    }
}
