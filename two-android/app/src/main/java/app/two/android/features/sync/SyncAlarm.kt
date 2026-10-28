package app.two.android.features.sync

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock

/**
 * A quarter-hour tick while the phone sleeps, for SyncService to check that
 * the connection - the page's or the listener's - is still really there.
 *
 * Inexact on purpose (setAndAllowWhileIdle): Android groups it with other
 * apps' wake-ups, and it needs no permission. An exact alarm needs one that
 * Android 14 denies by default.
 */
class SyncAlarm : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        SyncService.alarm(context ?: return)
    }

    companion object {
        private const val EVERY_MS = 15 * 60 * 1000L

        /** Sets the next tick; a tick already set is replaced. */
        fun arm(context: Context) {
            val app = context.applicationContext
            val alarms = app.getSystemService(AlarmManager::class.java) ?: return
            try {
                alarms.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + EVERY_MS,
                    pending(app)
                )
            } catch (_: Exception) {
                // Too many alarms on this phone; the network and Doze-exit
                // triggers still work.
            }
        }

        fun cancel(context: Context) {
            val app = context.applicationContext
            val alarms = app.getSystemService(AlarmManager::class.java) ?: return
            try {
                alarms.cancel(pending(app))
            } catch (_: Exception) {
                // Nothing set.
            }
        }

        private fun pending(context: Context): PendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, SyncAlarm::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }
}
