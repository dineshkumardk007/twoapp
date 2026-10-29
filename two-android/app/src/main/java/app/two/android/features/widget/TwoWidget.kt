package app.two.android.features.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.widget.RemoteViews
import app.two.android.MainActivity
import app.two.android.R

/**
 * The home-screen widget: tonight's moon over a night sky, with the day and
 * the date (SkyArt draws it). Nothing on it is about the two of you - no
 * name, no count, no heart - so to anyone else it is a moon widget.
 *
 * The one sign: a single bright star near the moon while a message is
 * waiting to be read (SkyNews, or the page's unread count). It comes out even
 * with Two swiped away, when the listener hears the message. Tapping the
 * widget opens Two. The launcher redraws it every 30 minutes, so the moon and
 * the date move on by themselves.
 */
class TwoWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) update(context, appWidgetManager, id)
    }

    /** Resized on the home screen: drawn again at the new size. */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        update(context, appWidgetManager, appWidgetId)
    }

    companion object {
        /** Redraws every moon widget on the home screen - after news, or the star going. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, TwoWidget::class.java))
            for (id in ids) update(context, manager, id)
        }

        private fun update(context: Context, manager: AppWidgetManager, id: Int) {
            manager.updateAppWidget(id, views(context, manager.getAppWidgetOptions(id)))
        }

        private fun views(context: Context, options: Bundle?): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_two)

            // On a phone held upright the widget is its narrowest and its tallest.
            val widthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
                ?.takeIf { it > 0 }?.toFloat() ?: DEFAULT_WIDTH_DP
            val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
                ?.takeIf { it > 0 }?.toFloat() ?: DEFAULT_HEIGHT_DP
            val news = SkyNews.has(context) || WidgetSummary.read(context).unread > 0

            try {
                val art = SkyArt.draw(
                    widthDp, heightDp, context.resources.displayMetrics.density, cornerDp(context), news
                )
                views.setImageViewBitmap(R.id.widget_art, art)
            } catch (_: Throwable) {
                // Out of memory: the still picture rather than an empty space.
                views.setImageViewResource(R.id.widget_art, R.drawable.widget_sky_preview)
            }
            views.setContentDescription(R.id.widget_art, SkyArt.phaseName(SkyArt.phase()))

            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val open = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, REQUEST_OPEN, open, flags)
            )
            return views
        }

        /** The launcher's corner radius for widgets (Android 12 and later), else the app's own. */
        private fun cornerDp(context: Context): Float {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    val px = context.resources.getDimension(android.R.dimen.system_app_widget_background_radius)
                    if (px > 0f) return px / context.resources.displayMetrics.density
                } catch (_: Exception) {
                    // Fall through to the app's own.
                }
            }
            return 24f
        }

        /** Four cells by two, before the launcher has said how big it made it. */
        private const val DEFAULT_WIDTH_DP = 320f
        private const val DEFAULT_HEIGHT_DP = 160f

        private const val REQUEST_OPEN = 43
    }
}
