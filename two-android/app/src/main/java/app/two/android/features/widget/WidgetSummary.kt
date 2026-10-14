package app.two.android.features.widget

import android.content.Context
import android.text.format.DateFormat
import android.text.format.DateUtils
import org.json.JSONObject
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Date

/**
 * What the widget knows about the two of you, as the page last told it
 * (core/widget.ts): names, dates, how each of you is, a count of unread
 * messages and a few times - never a word of any message. Kept in the app's
 * private preferences.
 */
class WidgetSummary private constructor(
    val partner: String,
    private val since: LocalDate?,
    private val anniversary: LocalDate?,
    private val anniversaryYears: Int,
    val unread: Int,
    private val lastMessageAt: Long,
    /** Their emotional weather as Two stores it: SUNNY, CALM, OVERCAST, RAINY or STORMY. */
    val theirWeather: String,
    /** Their capacity today, 0..5; -1 when they have not said. */
    val theirCapacity: Int,
    /** The same two for you: the widget shows you side by side. */
    val myWeather: String,
    val myCapacity: Int,
    private val online: Boolean,
    private val lastSeenAt: Long,
    private val updatedAt: Long
) {
    /** Nothing linked yet, or the space was left: the widget just opens Two. */
    val isEmpty: Boolean
        get() = partner.isEmpty()

    /** In Two right now - as the page said within the last five minutes. */
    val onlineNow: Boolean
        get() = online && System.currentTimeMillis() - updatedAt < 5 * 60_000L

    /** Whole days since the story began, counted today. */
    fun daysTogether(today: LocalDate = LocalDate.now()): Long? {
        val start = since ?: return null
        val days = ChronoUnit.DAYS.between(start, today)
        return if (days >= 0) days else null
    }

    /** "1,702" */
    fun daysText(): String? = daysTogether()?.let { NumberFormat.getIntegerInstance().format(it) }

    /** "Together since 14 Feb 2022" */
    fun sinceText(): String? =
        since?.let { "Together since " + it.format(DateTimeFormatter.ofPattern("d MMM yyyy")) }

    /** "Your 5th anniversary is in 124 days", or null once it has passed (an old summary). */
    fun anniversaryText(today: LocalDate = LocalDate.now()): String? {
        val day = anniversary ?: return null
        val until = ChronoUnit.DAYS.between(today, day)
        if (until < 0) return null
        val which = if (anniversaryYears > 0) "${ordinal(anniversaryYears)} anniversary" else "anniversary"
        return when (until) {
            0L -> "Happy $which!"
            1L -> "Your $which is tomorrow"
            else -> "Your $which is in $until days"
        }
    }

    /** "3 new messages from Priya · 9:41 pm", or "No new messages". */
    fun chatText(context: Context): String {
        if (unread <= 0) return "No new messages"
        val count = if (unread == 1) "1 new message" else "$unread new messages"
        val at = if (lastMessageAt > 0) " · " + timeText(context, lastMessageAt) else ""
        return "$count from $partner$at"
    }

    /** "Priya feels Clear · 4/5" */
    fun moodText(): String? {
        val word = weatherWord(theirWeather) ?: return null
        val cap = if (theirCapacity in 0..5) " · $theirCapacity/5" else ""
        return "$partner feels $word$cap"
    }

    /** Whether they were in Two, and when - as of the last update. */
    fun presenceText(context: Context): String? = when {
        onlineNow -> "$partner is in Two now"
        online -> "$partner was in Two at ${timeText(context, updatedAt)}"
        lastSeenAt > 0 -> "$partner was last in Two at ${timeText(context, lastSeenAt)}"
        else -> null
    }

    /** "Updated 9:41 pm": the widget only knows what Two last told it. */
    fun updatedText(context: Context): String? =
        if (updatedAt > 0) "Updated ${timeText(context, updatedAt)}" else null

    /** Everything the widget's picture shows, in words, for TalkBack. */
    fun spokenText(): String {
        if (isEmpty) return "Two. Open Two to link with your partner."
        val parts = mutableListOf("Two")
        daysText()?.let { parts += "$it days together" }
        weatherWord(myWeather)?.let { parts += "You feel $it" + heartsWords(myCapacity) }
        weatherWord(theirWeather)?.let { parts += "$partner feels $it" + heartsWords(theirCapacity) }
        if (onlineNow) parts += "$partner is in Two now"
        if (unread > 0) parts += if (unread == 1) "1 new message" else "$unread new messages"
        return parts.joinToString(". ")
    }

    companion object {
        private const val PREFS = "two_widget"
        private const val KEY_SUMMARY = "summary"
        private const val KEY_UPDATED = "updated_at"

        /** Stores what the page sent. "{}" clears it. */
        fun save(context: Context, json: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_SUMMARY, json)
                .putLong(KEY_UPDATED, System.currentTimeMillis())
                .apply()
        }

        fun read(context: Context): WidgetSummary {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val o = try {
                JSONObject(prefs.getString(KEY_SUMMARY, null) ?: "{}")
            } catch (_: Exception) {
                JSONObject()
            }
            return WidgetSummary(
                partner = o.optString("partner", "").take(40),
                since = date(o.optString("since", "")),
                anniversary = date(o.optString("annivDate", "")),
                anniversaryYears = o.optInt("annivYears", 0),
                unread = o.optInt("unread", 0).coerceAtLeast(0),
                lastMessageAt = o.optLong("lastMessageAt", 0L),
                theirWeather = o.optString("weather", "").take(20),
                theirCapacity = o.optInt("capacity", -1),
                myWeather = o.optString("myWeather", "").take(20),
                myCapacity = o.optInt("myCapacity", -1),
                online = o.optBoolean("online", false),
                lastSeenAt = o.optLong("lastSeenAt", 0L),
                updatedAt = prefs.getLong(KEY_UPDATED, 0L)
            )
        }

        /**
         * Emotional weather in the words Home uses for it
         * (EmotionalWeatherCard.tsx), or null when there is none.
         */
        fun weatherWord(code: String): String? = when (code.uppercase()) {
            "SUNNY" -> "Sunny"
            "CALM" -> "Clear"
            "OVERCAST" -> "Overcast"
            "RAINY" -> "Turbulent"
            "STORMY" -> "Stormy"
            else -> null
        }

        private fun heartsWords(capacity: Int): String =
            if (capacity in 0..5) ", $capacity of 5 hearts" else ""

        private fun date(value: String): LocalDate? = try {
            if (value.isEmpty()) null else LocalDate.parse(value)
        } catch (_: Exception) {
            null
        }

        private fun ordinal(n: Int): String {
            val suffix = if (n % 100 in 11..13) "th" else when (n % 10) {
                1 -> "st"
                2 -> "nd"
                3 -> "rd"
                else -> "th"
            }
            return "$n$suffix"
        }

        /** "9:41 pm" today; "13 Oct, 9:41 pm" on another day. */
        private fun timeText(context: Context, at: Long): String =
            if (DateUtils.isToday(at)) {
                DateFormat.getTimeFormat(context).format(Date(at))
            } else {
                DateUtils.formatDateTime(
                    context,
                    at,
                    DateUtils.FORMAT_SHOW_DATE or DateUtils.FORMAT_ABBREV_MONTH or DateUtils.FORMAT_SHOW_TIME
                )
            }
    }
}
