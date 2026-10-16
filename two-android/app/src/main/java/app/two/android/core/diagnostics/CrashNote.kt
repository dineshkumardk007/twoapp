package app.two.android.core.diagnostics

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Why Two last closed when it should not have, kept so it can be passed on.
 *
 * A crash on a phone never reaches anyone otherwise: Android closes the app,
 * and what went wrong stays in a log that only a computer on a cable can
 * read. So Two keeps a note of it - where in the code it stopped, the
 * version, the Android and the phone - in its own storage, and Settings
 * offers it to copy (the page's core/crashNote.ts) until it is dismissed.
 *
 * Only that technical part: nothing from the page, never a message.
 */
object CrashNote {

    private const val FILE = "last-crash.txt"
    private const val PREFS = "two_crash_note"

    /** Closes Android recorded up to this time were dismissed already. */
    private const val KEY_SEEN_UNTIL = "seen_until"

    private const val MAX_TEXT = 16_000

    /**
     * Notes anything the app throws and does not catch, then lets Android
     * close the app exactly as it would have.
     */
    fun install(context: Context) {
        val app = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                write(app, "Two closed: an error on its \"${thread.name}\" thread", Log.getStackTraceString(error))
            } catch (_: Throwable) {
                // Nothing more can be done from here.
            }
            previous?.uncaughtException(thread, error)
        }
    }

    /** Notes something that went wrong while the app stayed open. */
    fun record(context: Context, what: String, detail: String) {
        try {
            write(context.applicationContext, what, detail)
        } catch (_: Exception) {
            // A note that cannot be kept is not worth a second failure.
        }
    }

    /**
     * The newest unexpected close not yet dismissed, as JSON {at, text}, or
     * "" when there is none.
     *
     * Two's own note when it has one. Otherwise, from Android 11, what
     * Android itself recorded - which also covers what the app cannot catch
     * itself: a crash inside the WebView's own code, or the app freezing.
     */
    fun read(context: Context): String {
        val app = context.applicationContext
        val seenUntil = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_SEEN_UNTIL, 0L)
        val file = File(app.filesDir, FILE)
        if (file.exists() && file.lastModified() > seenUntil) {
            return JSONObject()
                .put("at", file.lastModified())
                .put("text", file.readText().take(MAX_TEXT + 1_000))
                .toString()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val recorded = androidRecorded(app, seenUntil) ?: return ""
            return JSONObject().put("at", recorded.first).put("text", recorded.second).toString()
        }
        return ""
    }

    /** Dismissed: the note goes, and nothing Android recorded until now is offered again. */
    fun clear(context: Context) {
        val app = context.applicationContext
        File(app.filesDir, FILE).delete()
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_SEEN_UNTIL, System.currentTimeMillis())
            .apply()
    }

    private fun write(context: Context, what: String, detail: String) {
        val text = header(context, what, System.currentTimeMillis()) + "\n" + detail.take(MAX_TEXT)
        File(context.filesDir, FILE).writeText(text)
    }

    private fun header(context: Context, what: String, at: Long): String {
        val version = try {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "?"
        } catch (_: Exception) {
            "?"
        }
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss Z", Locale.US).format(Date(at))
        return buildString {
            append(what).append('\n')
            append("When: ").append(time).append('\n')
            append("Two: ").append(version).append('\n')
            append("Android: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n")
            append("Phone: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n')
        }
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private fun androidRecorded(context: Context, seenUntil: Long): Pair<Long, String>? {
        val manager = context.getSystemService(ActivityManager::class.java) ?: return null
        val exits = try {
            manager.getHistoricalProcessExitReasons(context.packageName, 0, 8)
        } catch (_: Exception) {
            return null
        }
        val unexpected = setOf(
            ApplicationExitInfo.REASON_CRASH,
            ApplicationExitInfo.REASON_CRASH_NATIVE,
            ApplicationExitInfo.REASON_ANR
        )
        val exit = exits.firstOrNull { it.timestamp > seenUntil && it.reason in unexpected } ?: return null
        val what = when (exit.reason) {
            ApplicationExitInfo.REASON_CRASH -> "Two closed: an error in the app"
            ApplicationExitInfo.REASON_CRASH_NATIVE -> "Two closed: a crash in the WebView or the phone's own code"
            else -> "Two stopped responding"
        }
        val detail = buildString {
            append("Recorded by Android, reason ").append(exit.reason)
            val description = exit.description
            if (!description.isNullOrBlank()) append(": ").append(description)
            append('\n')
            append("Process: ").append(exit.processName).append(", importance ").append(exit.importance).append('\n')
            append(trace(exit))
        }
        return exit.timestamp to (header(context, what, exit.timestamp) + "\n" + detail.take(MAX_TEXT))
    }

    /**
     * The system's own record of the moment, where it kept one: the threads
     * of a freeze, as text, or a native crash's tombstone - a binary record,
     * of which the readable parts (the abort message, the functions on the
     * stack) are kept, as `strings` would find them.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    private fun trace(exit: ApplicationExitInfo): String {
        val bytes = try {
            exit.traceInputStream?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        } ?: return ""
        if (exit.reason == ApplicationExitInfo.REASON_ANR) {
            return String(bytes, Charsets.UTF_8).take(MAX_TEXT / 2)
        }
        val out = StringBuilder()
        val run = StringBuilder()
        for (b in bytes) {
            val c = b.toInt() and 0xFF
            if (c in 0x20..0x7E) {
                run.append(c.toChar())
            } else {
                if (run.length >= 6) out.append(run).append('\n')
                run.setLength(0)
                if (out.length > MAX_TEXT / 2) break
            }
        }
        if (run.length >= 6) out.append(run)
        return out.toString()
    }
}
