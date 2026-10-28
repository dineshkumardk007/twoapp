package app.two.android.features.sync

import android.content.Context
import android.content.SharedPreferences
import app.two.android.core.network.NetworkConfig
import org.json.JSONException
import org.json.JSONObject
import kotlin.math.max

/**
 * The couple room's details, kept outside the PIN vault, so the listener can
 * still say "this phone has it" while Two is locked or closed (RelayListener).
 *
 * Only what joining the room takes: the relay's address, the room id, this
 * phone's id, its seat and how far it has read. Never the pairing code, the
 * phrase or the key - without those nothing the listener is sent can be
 * opened. The page hands these over (AndroidWebBridge.backgroundRoomSet) and
 * wipes them on unpair and on the erase (backgroundRoomClear). allowBackup is
 * off, so none of it leaves the phone in a backup.
 */
object BackgroundRoomStore {
    private const val FILE = "two_background_room"
    private const val KEY_ROOM = "room"
    private const val KEY_LISTENER_SINCE = "listenerSince"
    private const val KEY_LISTENER_SEQ = "listenerSeq"
    private const val KEY_NOTIFY = "notify"
    private const val KEY_RECEIPTS_OK = "receiptsOk"
    private const val KEY_RECEIPTS_AT = "receiptsCheckedAt"

    /** The longest JSON the page sends; anything bigger is not ours. */
    private const val MAX_INPUT = 4_000

    /** The room as stored. The page's cursor is where its own replay starts too. */
    data class Room(
        val relayUrl: String,
        val healthUrl: String,
        val spaceId: String,
        val deviceId: String,
        val seat: String,
        val pageSince: Long,
        val pageSeq: Long,
        val disguised: Boolean,
        val noticeText: String,
        val updatedAt: Long
    )

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    /**
     * The page's JSON, checked. Only the named fields are read: whatever else
     * rides along - a key, a code, by some mistake - is never looked at, and
     * so never stored.
     */
    fun parseInput(json: String?, defaultNotice: String): RoomInput? {
        if (json == null || json.length > MAX_INPUT) return null
        val o = try {
            JSONObject(json)
        } catch (_: JSONException) {
            return null
        }
        return checkRoomInput(
            o.opt("v"),
            o.opt("spaceId"),
            o.opt("deviceId"),
            o.opt("seat"),
            o.opt("since"),
            o.opt("sinceSeq"),
            o.opt("disguised"),
            o.opt("noticeText"),
            defaultNotice
        )
    }

    /**
     * Stores what the page sent. Its cursor only ever moves forward: an older
     * page's push cannot send the listener back to replay what it has done.
     * Another room, phone id, seat or relay is a fresh start, and the
     * listener's own cursor and the relay check go with the old one.
     */
    @Synchronized
    fun save(context: Context, input: RoomInput): Room {
        val prefs = prefs(context)
        val old = room(context)
        val relayUrl = NetworkConfig.wsRelayUrl
        val same = old != null &&
            old.spaceId == input.spaceId &&
            old.deviceId == input.deviceId &&
            old.seat == input.seat &&
            old.relayUrl == relayUrl
        val kept = old?.takeIf { same }
        val room = Room(
            relayUrl = relayUrl,
            healthUrl = NetworkConfig.httpBaseUrl + "/health",
            spaceId = input.spaceId,
            deviceId = input.deviceId,
            seat = input.seat,
            pageSince = max(kept?.pageSince ?: 0L, input.since),
            pageSeq = max(kept?.pageSeq ?: 0L, input.sinceSeq),
            disguised = input.disguised,
            noticeText = input.noticeText,
            updatedAt = System.currentTimeMillis()
        )
        val edit = prefs.edit().putString(KEY_ROOM, room.toJson().toString())
        if (!same) {
            edit.remove(KEY_LISTENER_SINCE)
                .remove(KEY_LISTENER_SEQ)
                .remove(KEY_RECEIPTS_OK)
                .remove(KEY_RECEIPTS_AT)
        }
        edit.apply()
        return room
    }

    /** The stored room, or null when this phone is not paired (or was wiped). */
    fun room(context: Context): Room? {
        val text = prefs(context).getString(KEY_ROOM, null) ?: return null
        return try {
            val o = JSONObject(text)
            val relayUrl = o.optString("relayUrl")
            val spaceId = o.optString("spaceId")
            val deviceId = o.optString("deviceId")
            val seat = o.optString("seat")
            if (relayUrl.isEmpty() || spaceId.isEmpty() || deviceId.isEmpty() || seat.isEmpty()) {
                null
            } else {
                Room(
                    relayUrl = relayUrl,
                    healthUrl = o.optString("healthUrl"),
                    spaceId = spaceId,
                    deviceId = deviceId,
                    seat = seat,
                    // optLong: lamport values are about 1.7e12, past an Int.
                    pageSince = o.optLong("pageSince", 0L),
                    pageSeq = o.optLong("pageSeq", 0L),
                    disguised = o.optBoolean("disguised", false),
                    noticeText = o.optString("noticeText"),
                    updatedAt = o.optLong("updatedAt", 0L)
                )
            }
        } catch (_: JSONException) {
            null
        }
    }

    /** Where the listener starts: past both the page's cursor and its own. */
    fun startCursor(context: Context, room: Room, now: Long): StartCursor {
        val p = prefs(context)
        return pickStartCursor(
            room.pageSince,
            room.pageSeq,
            p.getLong(KEY_LISTENER_SINCE, 0L),
            p.getLong(KEY_LISTENER_SEQ, 0L),
            now
        )
    }

    /**
     * The listener's own cursor, after each batch it has answered. Never the
     * page's: the page replays from its own, so nothing is skipped for it.
     */
    @Synchronized
    fun saveListenerCursor(context: Context, since: Long, seq: Long) {
        val p = prefs(context)
        // Wiped meanwhile: nothing is written back into the emptied file.
        if (p.getString(KEY_ROOM, null) == null) return
        p.edit()
            .putLong(KEY_LISTENER_SINCE, max(since, p.getLong(KEY_LISTENER_SINCE, 0L)))
            .putLong(KEY_LISTENER_SEQ, max(seq, p.getLong(KEY_LISTENER_SEQ, 0L)))
            .apply()
    }

    /** What the relay's /health last said about receipts, and how long ago. */
    fun receipts(context: Context, now: Long): Receipts {
        val p = prefs(context)
        return receiptsState(p.getBoolean(KEY_RECEIPTS_OK, false), p.getLong(KEY_RECEIPTS_AT, 0L), now)
    }

    @Synchronized
    fun setReceipts(context: Context, ok: Boolean, now: Long) {
        val p = prefs(context)
        if (p.getString(KEY_ROOM, null) == null) return
        p.edit().putBoolean(KEY_RECEIPTS_OK, ok).putLong(KEY_RECEIPTS_AT, now).apply()
    }

    /** The "New message" switch. Off until the page turns it on. */
    fun notify(context: Context): Boolean = prefs(context).getBoolean(KEY_NOTIFY, false)

    fun setNotify(context: Context, on: Boolean) {
        prefs(context).edit().putBoolean(KEY_NOTIFY, on).apply()
    }

    /**
     * Every key in the file, the switch included. Written at once rather than
     * later: the erase may be followed by the app closing.
     */
    @Synchronized
    fun clear(context: Context) {
        prefs(context).edit().clear().commit()
    }

    private fun Room.toJson(): JSONObject = JSONObject()
        .put("v", 1)
        .put("relayUrl", relayUrl)
        .put("healthUrl", healthUrl)
        .put("spaceId", spaceId)
        .put("deviceId", deviceId)
        .put("seat", seat)
        .put("pageSince", pageSince)
        .put("pageSeq", pageSeq)
        .put("disguised", disguised)
        .put("noticeText", noticeText)
        .put("updatedAt", updatedAt)
}

/** The page's room details once checked (see checkRoomInput). */
data class RoomInput(
    val spaceId: String,
    val deviceId: String,
    val seat: String,
    val since: Long,
    val sinceSeq: Long,
    val disguised: Boolean,
    val noticeText: String
)

/** Where a listener connection starts; [fallback] when nothing has been read yet. */
data class StartCursor(val since: Long, val seq: Long, val fallback: Boolean)

/** The relay's answer on receipts: yes, no (an older relay), or time to ask again. */
enum class Receipts { OK, OLD, CHECK }

/** How long a relay's answer on receipts holds before it is asked again. */
internal const val RECEIPTS_RECHECK_MS = 6 * 60 * 60 * 1000L

/** How far back a listener with no cursor at all looks: ten minutes. */
internal const val FALLBACK_LOOKBACK_MS = 10 * 60 * 1000L

/**
 * Checks the page's fields, each as JSONObject.opt gave it. Null when any is
 * wrong: a room id that is not lower-case hex, an empty or overlong id or
 * seat, a cursor that is not a finite number of at least 0. An empty or
 * overlong notice text falls back to [defaultNotice] instead of losing the
 * room over a word.
 */
internal fun checkRoomInput(
    v: Any?,
    spaceId: Any?,
    deviceId: Any?,
    seat: Any?,
    since: Any?,
    sinceSeq: Any?,
    disguised: Any?,
    noticeText: Any?,
    defaultNotice: String
): RoomInput? {
    if (v != null && !(v is Number && v.toDouble() == 1.0)) return null
    if (spaceId !is String || spaceId.length !in 1..128) return null
    if (!spaceId.all { it in '0'..'9' || it in 'a'..'f' }) return null
    if (deviceId !is String || deviceId.length !in 1..128) return null
    if (seat !is String || seat.length !in 1..64) return null
    val sinceValue = cursorValue(since) ?: return null
    val seqValue = cursorValue(sinceSeq) ?: return null
    val text = (noticeText as? String)?.trim()?.takeIf { it.length in 1..40 } ?: defaultNotice
    return RoomInput(spaceId, deviceId, seat, sinceValue, seqValue, disguised == true, text)
}

private fun cursorValue(raw: Any?): Long? {
    if (raw !is Number) return null
    val d = raw.toDouble()
    if (d.isNaN() || d.isInfinite() || d < 0) return null
    return raw.toLong()
}

/**
 * The start is past whichever of the two cursors is further on. With no
 * cursor at all - both 0 - the listener looks back ten minutes rather than
 * asking for everything: a cursor of 0 and 0 is the relay's "replay it all",
 * up to thousands of records over her mobile data.
 */
internal fun pickStartCursor(
    pageSince: Long,
    pageSeq: Long,
    listenerSince: Long,
    listenerSeq: Long,
    now: Long
): StartCursor {
    val since = max(pageSince, listenerSince)
    val seq = max(pageSeq, listenerSeq)
    return if (since <= 0L && seq <= 0L) {
        StartCursor(now - FALLBACK_LOOKBACK_MS, 0L, true)
    } else {
        StartCursor(since, seq, false)
    }
}

/**
 * An answer holds for six hours. A clock that went backwards counts as stale,
 * so it is asked again rather than trusted for ever.
 */
internal fun receiptsState(ok: Boolean, checkedAt: Long, now: Long): Receipts {
    val fresh = checkedAt > 0L && now >= checkedAt && now - checkedAt < RECEIPTS_RECHECK_MS
    return when {
        !fresh -> Receipts.CHECK
        ok -> Receipts.OK
        else -> Receipts.OLD
    }
}
