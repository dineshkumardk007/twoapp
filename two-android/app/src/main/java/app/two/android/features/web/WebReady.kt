package app.two.android.features.web

/**
 * Whether the page has drawn its first real screen - the lock screen, the
 * first-run screens or the app itself - so the launch splash can step aside
 * for it rather than for an empty cream page.
 *
 * Set from the page through the bridge (AndroidWebBridge.appReady); read by
 * MainActivity's splash screen.
 */
object WebReady {
    @Volatile
    var ready: Boolean = false
        private set

    fun markReady() {
        ready = true
    }

    /**
     * A new activity loads the page afresh - after being swiped from Recents
     * while the radio kept the app alive, say - so it waits for that page's
     * own first screen, not the one before it.
     */
    fun reset() {
        ready = false
    }
}
