package app.two.android.features.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import app.two.android.R

/**
 * The home-screen widget: the two of you as two circles, each with how you
 * are today, the bright lens where they meet, your days together beneath and
 * a heart to send (WidgetArt draws it).
 *
 * Tapping it opens a small pop-up with more (WidgetPopupActivity); the heart
 * opens Two and sends a heartbeat. What it shows comes from the page
 * (core/widget.ts, through AndroidBridge.widgetUpdate) - names, dates, a count
 * and a few times, never a word of any message. The days are counted here,
 * so they move on at midnight even when Two has not been opened.
 */
class TwoWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val summary = WidgetSummary.read(context)
        for (id in appWidgetIds) update(context, appWidgetManager, id, summary)
    }

    /** Resized on the home screen: drawn again at the new size. */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        update(context, appWidgetManager, appWidgetId, WidgetSummary.read(context))
    }

    companion object {
        /** Redraws every Two widget on the home screen - after the page sent news. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, TwoWidget::class.java))
            if (ids.isEmpty()) return
            val summary = WidgetSummary.read(context)
            for (id in ids) update(context, manager, id, summary)
        }

        private fun update(context: Context, manager: AppWidgetManager, id: Int, summary: WidgetSummary) {
            manager.updateAppWidget(id, views(context, manager.getAppWidgetOptions(id), summary))
        }

        private fun views(context: Context, options: Bundle?, summary: WidgetSummary): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_two)

            // On a phone held upright the widget is its narrowest and its tallest.
            val widthDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
                ?.takeIf { it > 0 }?.toFloat() ?: DEFAULT_WIDTH_DP
            val heightDp = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
                ?.takeIf { it > 0 }?.toFloat() ?: DEFAULT_HEIGHT_DP
            val wide = WidgetArt.isWide(widthDp, heightDp)
            val showHeart = wide && !summary.isEmpty

            try {
                val art = WidgetArt.draw(
                    context, summary, widthDp, heightDp,
                    context.resources.displayMetrics.density, cornerDp(context), heart = showHeart
                )
                views.setImageViewBitmap(R.id.widget_art, art)
            } catch (_: Throwable) {
                // Out of memory, or a font that would not load: the still
                // picture rather than an empty space on the home screen.
                views.setImageViewResource(R.id.widget_art, R.drawable.widget_preview)
            }
            views.setContentDescription(R.id.widget_art, summary.spokenText())
            views.setViewVisibility(R.id.widget_heart, if (showHeart) View.VISIBLE else View.GONE)

            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            val popup = Intent(context, WidgetPopupActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, REQUEST_POPUP, popup, flags)
            )
            views.setOnClickPendingIntent(
                R.id.widget_heart,
                PendingIntent.getActivity(context, REQUEST_HEART, LaunchAction.intent(context, "heartbeat"), flags)
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

        private const val REQUEST_POPUP = 41
        private const val REQUEST_HEART = 42
    }
}
