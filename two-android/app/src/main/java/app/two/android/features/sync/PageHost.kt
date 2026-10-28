package app.two.android.features.sync

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import app.two.android.features.web.APP_HOST
import java.lang.ref.WeakReference

/**
 * Whether the page is there to do the relay's work itself.
 *
 * [alive]: the WebView exists. It ends when Two is swiped away, when Android
 * closes it, or when the page's own process dies. [relayOn]: the page says its
 * couple relay connection is on (AndroidWebBridge.backgroundPageRelay) - off
 * while it is locked, on the PIN screen, or just reloading.
 *
 * Both true: the page has its own connection, and the service only keeps it
 * alive and wakes it. Otherwise the native listener answers for it. Only one of
 * them is ever connected, or the relay would have the same phone twice and the
 * two would knock each other off.
 *
 * Volatile: the bridge, the service and the main thread all read them.
 */
object PageHost {
    @Volatile
    var alive = false

    @Volatile
    var relayOn = false

    /** Weak: this must never be what keeps a closed page in memory. */
    @Volatile
    private var page: WeakReference<WebView>? = null

    /** A page was made (TwoWebView's factory). Its relay starts off until it says. */
    fun opened(view: WebView) {
        page = WeakReference(view)
        alive = true
        SyncService.evaluate(view.context)
    }

    /**
     * The page is gone. [view] names which one, so a page released after its
     * replacement was made cannot take the new one down with it.
     */
    fun closed(context: Context, view: WebView? = null) {
        if (view != null) {
            val current = page?.get()
            if (current != null && current !== view) return
        }
        page = null
        alive = false
        relayOn = false
        SyncService.evaluate(context)
    }

    /** The Activity has ended for good; its page, if it is still the current one, with it. */
    fun activityGone(activity: Activity) {
        val view = page?.get()
        if (view != null && activityOf(view.context) !== activity) return
        closed(activity.applicationContext)
    }

    fun relay(context: Context, on: Boolean) {
        relayOn = on
        SyncService.evaluate(context)
    }

    /**
     * Nudges the page to check its connection now: a network that came back,
     * the phone out of deep sleep, the quarter-hour alarm. The page's own
     * timers stop while the phone sleeps, so a connection that died then is
     * otherwise not noticed until Two is opened. The page already listens for
     * 'online' (core/ws.ts), which checks and reconnects every connection.
     * Only ever the app's own page.
     */
    fun wake() {
        Handler(Looper.getMainLooper()).post {
            val view = page?.get() ?: return@post
            if (!alive) return@post
            if (Uri.parse(view.url ?: "").host != APP_HOST) return@post
            try {
                view.evaluateJavascript("window.dispatchEvent(new Event('online'))", null)
            } catch (_: Exception) {
                // A page being torn down; the next one connects on its own.
            }
        }
    }

    private fun activityOf(context: Context): Activity? {
        var current: Context? = context
        while (current is ContextWrapper) {
            if (current is Activity) return current
            current = current.baseContext
        }
        return null
    }
}
