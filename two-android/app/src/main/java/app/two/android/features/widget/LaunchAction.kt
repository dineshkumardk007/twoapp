package app.two.android.features.widget

import android.content.Context
import android.content.Intent
import app.two.android.MainActivity

/**
 * What the home-screen widget opened Two to do: "chat" or "heartbeat".
 *
 * Held here until the page asks for it (AndroidBridge.takeLaunchAction),
 * which it does once it is unlocked and linked - so a heartbeat asked for
 * from the widget while Two is behind its PIN goes as soon as the PIN is in.
 */
object LaunchAction {
    private const val EXTRA = "app.two.android.LAUNCH_ACTION"

    @Volatile
    private var pending: String? = null

    /** An intent that opens Two (bringing it forward if it is already open). */
    fun intent(context: Context, action: String?): Intent =
        Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (action != null) putExtra(EXTRA, action)
        }

    /** Called by MainActivity with the intent it was opened, or brought forward, with. */
    fun offer(intent: Intent?) {
        val action = intent?.getStringExtra(EXTRA) ?: return
        if (action == "chat" || action == "heartbeat") pending = action
        intent?.removeExtra(EXTRA)
    }

    /** The page asks once; "" when there is nothing to do. */
    fun take(): String {
        val action = pending ?: return ""
        pending = null
        return action
    }
}
