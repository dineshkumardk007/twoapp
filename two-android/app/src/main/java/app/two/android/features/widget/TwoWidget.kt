package app.two.android.features.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import app.two.android.R

/**
 * The home-screen widget: your days together, one line about your partner,
 * and a heart.
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
        for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, views(context, summary))
    }

    companion object {
        /** Redraws every Two widget on the home screen - after the page sent news. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, TwoWidget::class.java))
            if (ids.isEmpty()) return
            val summary = WidgetSummary.read(context)
            for (id in ids) manager.updateAppWidget(id, views(context, summary))
        }

        private fun views(context: Context, summary: WidgetSummary): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_two)
            val days = summary.daysText()
            if (summary.isEmpty || days == null) {
                views.setTextViewText(R.id.widget_days, "Two")
                views.setViewVisibility(R.id.widget_days_label, View.GONE)
                views.setTextViewText(
                    R.id.widget_line,
                    if (summary.isEmpty) "Open Two" else summary.widgetLine(context)
                )
            } else {
                views.setTextViewText(R.id.widget_days, days)
                views.setViewVisibility(R.id.widget_days_label, View.VISIBLE)
                views.setTextViewText(R.id.widget_line, summary.widgetLine(context))
            }
            views.setViewVisibility(R.id.widget_badge, if (summary.unread > 0) View.VISIBLE else View.GONE)
            views.setTextViewText(R.id.widget_badge, if (summary.unread > 99) "99+" else summary.unread.toString())

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

        private const val REQUEST_POPUP = 41
        private const val REQUEST_HEART = 42
    }
}
