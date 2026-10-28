package app.two.android.features.web

/**
 * Whether Two is out of sight, as the Activity sees it: stopped, or the screen
 * off. Told to the page as it changes (window.__twoLifecycle, from TwoWebView)
 * and read by a page that has just loaded (AndroidWebBridge.lifecycleState),
 * which nobody would tell until the next change.
 *
 * Volatile: the bridge reads it on its own thread.
 */
object PageShown {
    @Volatile
    var away: Boolean = false
}
