package app.two.android.features.sync

import android.content.Context
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject

/**
 * A short diary of how messages reach this phone while Two is out of sight,
 * for the page's "Message delivery" check: when the background connection
 * started, joined, dropped, when a message came and a notice went up - and,
 * above all, when the phone itself closed Two, which is what a phone maker's
 * battery saver does and nothing in Two can see happen.
 *
 * Only times and what kind of thing happened. Never who, never what, never a
 * message or an id. Kept in this phone's own storage, never sent, and wiped
 * with the room (SyncService.clear).
 *
 * The closing is found afterwards: the service notes a heartbeat at every
 * wake-up and says when it stops on purpose. Starting again with neither -
 * the last heartbeat long ago and no stop - means it was ended from outside.
 */
internal object DeliveryLog {
    private const val PREFS = "two_delivery"
    private const val KEY_LOG = "log"
    private const val KEY_BEAT = "beat"
    private const val KEY_BEAT_UP = "beatUp"
    private const val KEY_CLEAN = "clean"

    /** Kept: the newest this many. */
    private const val MAX = 80

    /** The same thing again this soon is the same thing, counted, not a new line. */
    private const val SAME_WITHIN_MS = 10 * 60 * 1000L

    /** Gone longer than this, with no stop said, is the phone having closed it. */
    private const val CLOSED_AFTER_MS = 20 * 60 * 1000L

    /** What happened. The page says each in words. */
    enum class Event(val wire: String) {
        STARTED("started"),
        JOINED("joined"),
        DROPPED("dropped"),
        PAGE_UP("page-up"),
        PAGE_DOWN("page-down"),
        MESSAGE("message"),
        NOTICE("notice"),
        CLOSED("closed"),
        REBOOTED("rebooted")
    }

    @Synchronized
    fun add(context: Context, event: Event, detail: Long = 0L) {
        try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val log = try {
                JSONArray(prefs.getString(KEY_LOG, "[]"))
            } catch (_: Exception) {
                JSONArray()
            }
            val now = System.currentTimeMillis()
            val last = log.optJSONObject(log.length() - 1)
            if (last != null && last.optString("e") == event.wire && now - last.optLong("t") < SAME_WITHIN_MS) {
                // Counted on the line it already has; its time moves on.
                last.put("t", now).put("n", last.optInt("n", 1) + 1)
            } else {
                val entry = JSONObject().put("t", now).put("e", event.wire)
                if (detail != 0L) entry.put("d", detail)
                log.put(entry)
            }
            val kept = JSONArray()
            for (i in maxOf(0, log.length() - MAX) until log.length()) kept.put(log.get(i))
            prefs.edit().putString(KEY_LOG, kept.toString()).apply()
        } catch (_: Exception) {
            // A diary that cannot be written is only a diary.
        }
    }

    /** The diary, oldest first, as JSON for the page. */
    fun json(context: Context): String = try {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LOG, "[]") ?: "[]"
    } catch (_: Exception) {
        "[]"
    }

    /** The service is alive and working: noted at each wake-up. */
    fun beat(context: Context) {
        try {
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong(KEY_BEAT, System.currentTimeMillis())
                .putLong(KEY_BEAT_UP, SystemClock.elapsedRealtime())
                .putBoolean(KEY_CLEAN, false)
                .apply()
        } catch (_: Exception) {
            // Looked at again at the next wake-up.
        }
    }

    /** The service stopped on purpose: not paired, or Two's own decision. */
    fun stoppedCleanly(context: Context) {
        try {
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(KEY_CLEAN, true)
                .apply()
        } catch (_: Exception) {
            // At worst a closing is reported that was not one.
        }
    }

    /**
     * A new service is starting: was the last one ended from outside? Notes
     * the phone restarting, or the phone having closed Two (with how many
     * minutes it was gone), then starts the heartbeat afresh.
     */
    @Synchronized
    fun starting(context: Context) {
        try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val beat = prefs.getLong(KEY_BEAT, 0L)
            val beatUp = prefs.getLong(KEY_BEAT_UP, 0L)
            val clean = prefs.getBoolean(KEY_CLEAN, true)
            val now = System.currentTimeMillis()
            if (beat > 0L && !clean) {
                when {
                    // The clock since the phone started is less than it was: it restarted.
                    SystemClock.elapsedRealtime() < beatUp -> add(context, Event.REBOOTED)
                    now - beat > CLOSED_AFTER_MS -> add(context, Event.CLOSED, (now - beat) / 60_000L)
                }
            }
        } catch (_: Exception) {
            // Nothing to report.
        }
        add(context, Event.STARTED)
        beat(context)
    }

    fun clear(context: Context) {
        try {
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        } catch (_: Exception) {
            // Nothing kept.
        }
    }
}
