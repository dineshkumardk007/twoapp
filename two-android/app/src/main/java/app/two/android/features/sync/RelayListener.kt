package app.two.android.features.sync

import android.content.Context
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * The couple room, joined on the page's behalf while the page is gone or its
 * relay is off - swiped away, locked, on the PIN screen.
 *
 * It joins as a passive member with the page's own device id. The relay then
 * sends it only what a record is - its id, its type, who wrote it - never the
 * message itself, which it could not open anyway: the key stays in the PIN
 * vault and in the page. For each message of hers it tells the relay "this
 * phone has it" (RECEIVED), and the relay passes that to her phone as two
 * grey ticks. Never blue: only the page, opened and read, can say a message
 * was read.
 *
 * Passive means the relay never counts it as here - she is not shown online -
 * and refuses it while the page's own connection is up, so the two never knock
 * each other off. It never sends a record, a call signal or anything else.
 *
 * Everything runs on [work], the service's one thread; OkHttp's callbacks are
 * handed over to it, and a callback from a connection already replaced is
 * dropped (generation).
 */
class RelayListener(
    private val context: Context,
    private val work: ScheduledExecutorService,
    private val owner: Owner
) {
    /** The service, told how the connection is going. Called on [work]. */
    interface Owner {
        fun onJoined()

        /** The connection ended by itself or was refused; [code] is the close code, -1 for a failure. */
        fun onEnded(code: Int)

        /** The relay has no receipts: an older relay. */
        fun onOldRelay()
    }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder().pingInterval(60, TimeUnit.SECONDS).build()
    }

    /** /health has ten seconds: a relay waking from its free-plan sleep is asked again later. */
    private val healthClient: OkHttpClient by lazy {
        client.newBuilder().callTimeout(10, TimeUnit.SECONDS).build()
    }

    private var socket: WebSocket? = null
    private var generation = 0
    private var joined = false

    /** The first replay is over: what arrives now is answered at once. */
    private var live = false

    /** The ten-minute look-back of a listener with no cursor: no notice for any of it. */
    private var quiet = false

    /** A message of hers came in during this replay, for one notice at its end. */
    private var heard = false

    private var seat = ""
    private var since = 0L
    private var seq = 0L
    private val pending = LinkedHashSet<String>()
    private val recent = RecentIds(RECENT_IDS)
    private var pongWait: ScheduledFuture<*>? = null
    private var healthCall: Call? = null

    /** Joined and answering. */
    val connected: Boolean get() = socket != null && joined

    /** Connecting, connected, or asking /health. */
    val busy: Boolean get() = socket != null || healthCall != null

    /**
     * Asks the relay's /health whether it takes receipts. [answered] gets true
     * or false from a relay that answered, or null when it could not be
     * reached - no network, or a relay still waking up - which is not an
     * answer, and is asked again.
     */
    fun checkHealth(url: String, answered: (Boolean?) -> Unit) {
        if (healthCall != null) return
        val request = try {
            Request.Builder().url(url).build()
        } catch (_: IllegalArgumentException) {
            answered(null)
            return
        }
        val asking = healthClient.newCall(request)
        healthCall = asking
        asking.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                post {
                    if (healthCall === asking) {
                        healthCall = null
                        answered(null)
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val receipts: Boolean? = try {
                    response.use {
                        if (!it.isSuccessful) {
                            null
                        } else {
                            JSONObject(it.body?.string().orEmpty()).optBoolean("receipts", false)
                        }
                    }
                } catch (_: Exception) {
                    null
                }
                post {
                    if (healthCall === asking) {
                        healthCall = null
                        answered(receipts)
                    }
                }
            }
        })
    }

    /** Connects, from wherever the page and the listener between them had read to. */
    fun open(room: BackgroundRoomStore.Room) {
        close()
        val request = try {
            Request.Builder().url(room.relayUrl).build()
        } catch (_: IllegalArgumentException) {
            owner.onEnded(-1)
            return
        }
        val start = BackgroundRoomStore.startCursor(context, room, System.currentTimeMillis())
        since = start.since
        seq = start.seq
        quiet = start.fallback
        heard = false
        seat = room.seat
        joined = false
        live = false
        dropPending()
        val gen = ++generation
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                post { if (gen == generation) opened(room) }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                post { if (gen == generation) message(text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                try {
                    webSocket.close(1000, null)
                } catch (_: Exception) {
                    // Already closing.
                }
                post { if (gen == generation) ended(code) }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                post { if (gen == generation) ended(code) }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                post { if (gen == generation) ended(-1) }
            }
        })
    }

    /** Our own close (1000): the page has taken over, or there is nothing to listen for. */
    fun close() {
        healthCall?.cancel()
        healthCall = null
        pongWait?.cancel(false)
        pongWait = null
        val ws = socket ?: return
        socket = null
        generation++
        joined = false
        live = false
        dropPending()
        try {
            ws.close(1000, null)
        } catch (_: Exception) {
            // Already gone.
        }
    }

    /**
     * After a long sleep or a network change a connection can look open and
     * be dead. A ping must be answered within ten seconds, or the connection
     * is dropped and made again.
     */
    fun checkAlive() {
        val ws = socket ?: return
        if (!joined || pongWait != null) return
        // Refused: the socket is already closing, and its end arrives by itself.
        if (!ws.send("{\"type\":\"PING\"}")) return
        val gen = generation
        pongWait = work.schedule(Runnable {
            if (gen != generation || pongWait == null) return@Runnable
            pongWait = null
            Log.i(TAG, "No answer to a ping: connecting again")
            val dead = socket
            socket = null
            generation++
            joined = false
            live = false
            dropPending()
            dead?.cancel()
            owner.onEnded(-1)
        }, PONG_WAIT_S, TimeUnit.SECONDS)
    }

    private fun opened(room: BackgroundRoomStore.Room) {
        val ws = socket ?: return
        WakeLocks.hold(context, SyncService.LISTEN_TAG, 5_000L)
        val join = JSONObject()
            .put("type", "JOIN")
            .put("spaceId", room.spaceId)
            .put("userId", room.deviceId)
            .put("role", room.seat)
            .put("since", since)
            .put("sinceSeq", seq)
            .put("passive", true)
        ws.send(join.toString())
    }

    private fun message(text: String) {
        val msg = try {
            JSONObject(text)
        } catch (_: JSONException) {
            return
        }
        when (msg.optString("type")) {
            "JOINED" -> if (msg.optBoolean("receipts", false)) {
                joined = true
                owner.onJoined()
            } else {
                // An older relay that let the JOIN through without knowing it
                // was passive: it would count her as here and send her every
                // message whole. Leave at once.
                Log.i(TAG, "This relay does not take receipts yet")
                close()
                owner.onOldRelay()
            }
            "RECORD_META" -> msg.optJSONObject("record")?.let { meta(it) }
            "REPLAY_COMPLETE" -> replayDone(msg.optBoolean("more", false))
            "PONG" -> {
                pongWait?.cancel(false)
                pongWait = null
            }
            // Noted, nothing more: there is no retrying a RECEIVED.
            "RECEIVED_ACK" -> Log.d(TAG, "Relay marked ${msg.optInt("count")}")
            "ERROR" -> Log.d(TAG, "Relay said: ${msg.optString("error")}")
        }
    }

    private fun meta(record: JSONObject) {
        val lamport = record.optLong("lamportClock", 0L)
        val recordSeq = record.optLong("seq", 0L)
        if (lamport > since) since = lamport
        if (recordSeq > seq) seq = recordSeq
        val id = record.optString("id")
        val author = record.optString("authorId")
        // Her chat messages only: not mine from my other phone, not reactions
        // or receipts, and each one once even if the relay replays it.
        val fresh = record.optString("type") == "CHAT" &&
            author.isNotEmpty() && author != seat &&
            id.length in 1..64 &&
            recent.add(id)
        if (fresh) {
            pending.add(id)
            if (!quiet) heard = true
        }
        if (live) {
            flushAndSave()
            noticeIfHeard()
        } else if (pending.size >= RECEIVED_BATCH) {
            flushAndSave()
        }
    }

    private fun replayDone(more: Boolean) {
        flushAndSave()
        if (more) {
            socket?.send(
                JSONObject().put("type", "REPLAY_MORE").put("since", since).put("sinceSeq", seq).toString()
            )
        } else {
            live = true
            quiet = false
        }
        noticeIfHeard()
    }

    private fun noticeIfHeard() {
        if (!heard) return
        heard = false
        NewMessageNotice.fromListener(context)
    }

    /**
     * Answers what is pending, then keeps the cursor - only when every batch
     * went out, so a batch that did not is replayed and answered next time.
     */
    private fun flushAndSave() {
        if (flush()) BackgroundRoomStore.saveListenerCursor(context, since, seq)
    }

    private fun flush(): Boolean {
        val ws = socket ?: return false
        if (pending.isEmpty()) return true
        // The phone stays awake until the answer is out.
        WakeLocks.hold(context, SyncService.LISTEN_TAG, 5_000L)
        var allSent = true
        for (batch in pending.toList().chunked(RECEIVED_BATCH)) {
            val sent = ws.send(JSONObject().put("type", "RECEIVED").put("recordIds", JSONArray(batch)).toString())
            if (!sent) {
                allSent = false
                batch.forEach { recent.remove(it) }
            }
        }
        pending.clear()
        return allSent
    }

    /**
     * Pending ids that never went out leave the LRU too: the connection that
     * follows replays them from the saved cursor, and answers them then.
     */
    private fun dropPending() {
        pending.forEach { recent.remove(it) }
        pending.clear()
    }

    private fun ended(code: Int) {
        if (socket == null) return
        socket = null
        joined = false
        live = false
        dropPending()
        pongWait?.cancel(false)
        pongWait = null
        owner.onEnded(code)
    }

    private fun post(block: () -> Unit) {
        try {
            work.execute { block() }
        } catch (_: RejectedExecutionException) {
            // The service has ended.
        }
    }

    private companion object {
        const val TAG = "TwoListen"
        const val RECENT_IDS = 500
        const val RECEIVED_BATCH = 300
        const val PONG_WAIT_S = 10L
    }
}

/**
 * The last [limit] ids seen, oldest dropped first: a record the relay sends
 * twice - a replay overlapping what came live - is answered once.
 */
internal class RecentIds(private val limit: Int) {
    private val ids = LinkedHashSet<String>()

    /** True when [id] is new. */
    fun add(id: String): Boolean {
        if (!ids.add(id)) return false
        if (ids.size > limit) {
            val oldest = ids.iterator()
            oldest.next()
            oldest.remove()
        }
        return true
    }

    fun remove(id: String) {
        ids.remove(id)
    }

    val size: Int get() = ids.size
}
