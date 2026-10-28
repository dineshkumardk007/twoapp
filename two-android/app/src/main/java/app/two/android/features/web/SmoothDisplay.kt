package app.two.android.features.web

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.view.Display

/**
 * The screen's fastest refresh rate for Two while it is in front.
 *
 * A phone with a 90 or 120 Hz screen does not give every app the fast rate.
 * Several makers keep it for a list of apps they know and run the rest at
 * 60, so scrolling Two looked stepped next to the other apps on the same
 * phone. Asking for it here is what those other apps do for themselves.
 *
 * Not in battery saver, and not in the Nightstand's bedside mode, where the
 * clock sits still all night: there the phone picks, as it did before.
 */
object SmoothDisplay {
    /** Bedside mode is on (applyBedside). Main thread only. */
    var bedside = false

    /** Asks for the rate that fits now; the window is only touched when that changes. */
    fun apply(activity: Activity) {
        val window = activity.window
        val attributes = window.attributes
        val rate = wanted(activity)
        if (attributes.preferredRefreshRate == rate) return
        attributes.preferredRefreshRate = rate
        window.attributes = attributes
    }

    /**
     * The fastest rate at the screen's current resolution, or 0 - "no
     * preference" - when there is nothing faster than 60 to ask for.
     */
    fun wanted(activity: Activity): Float = try {
        val power = activity.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val display = displayOf(activity)
        if (bedside || power?.isPowerSaveMode == true || display == null) {
            0f
        } else {
            val current = display.mode
            val fastest = display.supportedModes
                .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
                .maxOfOrNull { it.refreshRate } ?: 0f
            if (fastest > 61f) fastest else 0f
        }
    } catch (_: Exception) {
        // A screen that will not say what it can do: the phone's own choice.
        0f
    }

    private fun displayOf(activity: Activity): Display? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.display
        } else {
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay
        }
}
