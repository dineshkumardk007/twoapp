package app.two.android.features.widget

import android.content.Context

/**
 * Whether the moon widget's star is out: a message came while Two was out of
 * sight - in the background, locked, or swiped away and heard by the
 * listener - and has not been read yet.
 *
 * Kept here rather than in [WidgetSummary], because the listener that hears
 * a message with Two closed has no page to tell it; and put away again as
 * soon as the page says nothing is unread.
 */
object SkyNews {
    private const val PREFS = "two_sky"
    private const val KEY = "news_at"

    fun has(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY, 0L) > 0L

    /** A message has come: the star comes out, on every moon widget. */
    fun mark(context: Context) {
        val app = context.applicationContext
        if (has(app)) return
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(KEY, System.currentTimeMillis()).apply()
        TwoWidget.refresh(app)
    }

    /** All read, with a redraw to follow: the star goes, and nothing is redrawn here. */
    fun clearQuietly(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
    }

    /** All read: the star goes. */
    fun clear(context: Context) {
        val app = context.applicationContext
        if (!has(app)) return
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
        TwoWidget.refresh(app)
    }
}
