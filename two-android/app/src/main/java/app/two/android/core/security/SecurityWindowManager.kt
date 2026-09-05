package app.two.android.core.security

import android.app.Activity
import android.view.WindowManager

/**
 * Manages FLAG_SECURE window state.
 * Prevents third-party screenshot captures and blurs/masks the application preview
 * in Android's recent tasks switcher.
 */
object SecurityWindowManager {

    fun applyWindowProtection(activity: Activity, isEnabled: Boolean) {
        if (isEnabled) {
            activity.window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        } else {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }
}
