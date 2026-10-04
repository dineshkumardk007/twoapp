package app.two.android.features.radio

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * Between the page and the radio service: what the page asks for goes to the
 * player, and what the player does comes back to the page.
 *
 * The page keeps deciding - which station, when to try again, when a station
 * is off air (liveRadio.ts) - and is told everything the player does,
 * including what happens without it: pause from the lock screen, a phone
 * call, headphones pulled out, the notification swiped away.
 *
 * Everything runs on the main thread; the page's calls arrive on the
 * WebView's own thread and are passed across.
 */
object RadioRemote {

    private val main = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var sink: ((String) -> Unit)? = null
    private var pending: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null

    /** The station as the page described it: url, name, subtitle, hls and the rest. */
    private var station: JSONObject? = null
    private var sleep: Runnable? = null

    @Volatile
    private var lastStatus: String = JSONObject().put("event", "idle").toString()

    /** The page to report to - the newest one, after a reload. Main thread. */
    fun attach(context: Context, emit: (String) -> Unit) {
        appContext = context.applicationContext
        sink = emit
    }

    /** Plays a station, given as JSON with at least url, name and hls. */
    fun play(stationJson: String, volume: Double) {
        val s = try {
            JSONObject(stationJson)
        } catch (_: Exception) {
            return
        }
        val url = s.optString("url")
        if (!RadioUrls.isSafe(Uri.parse(url))) return
        main.post {
            station = s
            withController { c ->
                // Stopped, or another station asked for, while the player was
                // still being connected: this one is no longer wanted.
                if (station !== s) return@withController
                val extras = Bundle().apply {
                    putBoolean(RadioPlaybackService.EXTRA_HLS, s.optBoolean("hls"))
                }
                val item = MediaItem.Builder()
                    .setMediaId(url)
                    .setUri(url)
                    .setRequestMetadata(
                        MediaItem.RequestMetadata.Builder()
                            .setMediaUri(Uri.parse(url))
                            .setExtras(extras)
                            .build()
                    )
                    .setMediaMetadata(
                        MediaMetadata.Builder()
                            .setTitle(s.optString("name"))
                            .setArtist(s.optString("subtitle"))
                            .build()
                    )
                    .build()
                c.volume = volume.toFloat().coerceIn(0f, 1f)
                c.setMediaItem(item)
                c.prepare()
                c.play()
            }
        }
    }

    fun stop() {
        main.post {
            cancelSleep()
            station = null
            lastStatus = JSONObject().put("event", "idle").toString()
            controller?.let {
                it.stop()
                it.clearMediaItems()
            }
        }
    }

    fun setVolume(volume: Double) {
        main.post { controller?.volume = volume.toFloat().coerceIn(0f, 1f) }
    }

    /**
     * Stops the radio at this time (epoch milliseconds), or never for 0.
     * Kept here as well as in the page, so the sleep timer ends the radio even
     * if the page has been closed.
     */
    fun sleepAt(epochMs: Double) {
        main.post {
            cancelSleep()
            val delay = epochMs.toLong() - System.currentTimeMillis()
            if (epochMs <= 0 || delay <= 0) return@post
            val r = Runnable {
                sleep = null
                if (station != null) {
                    report("stopped")
                    stop()
                }
            }
            sleep = r
            main.postDelayed(r, delay)
        }
    }

    /** What the radio is doing now, for a page that has just loaded. */
    fun status(): String = lastStatus

    // ---------------------------------------------------------------- inside

    private fun cancelSleep() {
        sleep?.let { main.removeCallbacks(it) }
        sleep = null
    }

    /** Stopped by something other than the page: the page is told, and the station forgotten. */
    private fun stoppedOutside() {
        cancelSleep()
        report("stopped")
        station = null
        lastStatus = JSONObject().put("event", "idle").toString()
    }

    private fun report(event: String) {
        val json = JSONObject().put("event", event)
        station?.let { json.put("station", it) }
        lastStatus = json.toString()
        sink?.invoke("window.__twoRadio && window.__twoRadio(" + JSONObject.quote(lastStatus) + ")")
    }

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            if (!events.containsAny(
                    Player.EVENT_IS_PLAYING_CHANGED,
                    Player.EVENT_PLAYBACK_STATE_CHANGED,
                    Player.EVENT_PLAY_WHEN_READY_CHANGED
                )
            ) return
            // A stop from the page has already forgotten the station.
            if (station == null) return
            when {
                player.isPlaying -> report("playing")
                // Stopped from outside the app: a headset's or a car's stop
                // button, the notification. (An error is reported by itself.)
                // The station is taken off the player too, so a play button
                // pressed later cannot start it behind the page's back.
                player.playbackState == Player.STATE_IDLE -> if (player.playerError == null) {
                    stoppedOutside()
                    player.clearMediaItems()
                }
                player.playbackState == Player.STATE_ENDED -> report("ended")
                // Paused from outside the app - the lock screen, a headset,
                // headphones pulled out - while playing or still connecting.
                !player.playWhenReady -> report("paused")
                player.playbackState == Player.STATE_BUFFERING -> report("buffering")
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            // A live stream left too far behind is restarted by the service itself.
            if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) return
            if (station != null) report("error")
        }
    }

    private fun withController(action: (MediaController) -> Unit) {
        val ready = controller
        if (ready != null && ready.isConnected) {
            action(ready)
            return
        }
        val context = appContext ?: return
        val future = pending ?: MediaController.Builder(
            context,
            SessionToken(context, ComponentName(context, RadioPlaybackService::class.java))
        )
            .setListener(object : MediaController.Listener {
                // The player's service was shut down. Rare - this controller
                // keeps it running - but then the page is told the radio is off.
                override fun onDisconnected(controller: MediaController) {
                    this@RadioRemote.controller = null
                    pending = null
                    if (station != null) stoppedOutside()
                }
            })
            .buildAsync()
            .also { pending = it }

        future.addListener({
            val connected = try {
                future.get()
            } catch (_: Exception) {
                pending = null
                if (station != null) report("error")
                return@addListener
            }
            if (controller !== connected) {
                controller = connected
                connected.addListener(listener)
            }
            action(connected)
        }, ContextCompat.getMainExecutor(context))
    }
}
