package app.two.android.features.web

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Base64
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import org.json.JSONObject
import java.io.File

/**
 * Voice notes at your ear, the way a phone call sounds.
 *
 * While a voice note plays, the page asks for the proximity sensor
 * ([watch]). Raise the phone and the page hands the note over ([play]): it
 * carries on from the same moment through the earpiece, quietly, with the
 * screen dark against the cheek. Lower it and it stops where it was, and the
 * page takes it back - rather than carrying on out loud.
 *
 * A WebView cannot do this itself: it plays recordings as media, which
 * always leaves through the loudspeaker. Here the note is played as voice
 * communication, which the phone sends to the earpiece.
 *
 * All of it runs on the main thread. [report] tells the page what happened,
 * through window.__twoEar (see core/earpiece.ts):
 *   {event: "near" | "far"}
 *   {event: "stopped", id, positionMs, reason: lowered | ended | error | busy}
 */
@OptIn(UnstableApi::class)
class EarpieceVoice(
    context: Context,
    private val report: (JSONObject) -> Unit
) : SensorEventListener {

    private val app = context.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val sensors = app.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val proximity: Sensor? = sensors?.getDefaultSensor(Sensor.TYPE_PROXIMITY)
    private val audio = app.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val power = app.getSystemService(Context.POWER_SERVICE) as? PowerManager

    private var watching = false
    private var near = false
    private var player: ExoPlayer? = null
    private var playingId: String? = null
    private var screenDark: PowerManager.WakeLock? = null

    /** False on a phone without a proximity sensor: the page never asks. */
    val available: Boolean
        get() = proximity != null

    /** Sensor on while a note plays; off when it stops (and not at the ear). */
    fun watch(on: Boolean) {
        main.post {
            if (on) {
                val sensor = proximity ?: return@post
                if (watching) return@post
                // The first reading arrives straight away, so a phone that
                // is already at an ear is known to be.
                watching = sensors?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL) == true
            } else {
                if (watching) sensors?.unregisterListener(this)
                watching = false
                near = false
            }
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        val sensor = proximity ?: return
        val distance = event?.values?.firstOrNull() ?: return
        // Most sensors only say near (0) or far (their maximum range);
        // anything closer than both the range and 5 cm counts as an ear.
        val nowNear = distance < minOf(sensor.maximumRange, 5f)
        if (nowNear == near) return
        near = nowNear
        report(JSONObject().put("event", if (nowNear) "near" else "far"))
        if (!nowNear && player != null) finish("lowered")
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    /**
     * Plays [base64] (the note's recording) through the earpiece, from
     * [positionMs], at [rate]. Answers with "stopped" when it ends, is
     * lowered, fails, or cannot start because a call has the earpiece.
     */
    fun play(id: String, base64: String, positionMs: Long, rate: Float) {
        // Decoded here, on the bridge's thread, rather than on the main one.
        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            null
        }
        main.post {
            stopPlayer()
            val am = audio
            if (bytes == null || bytes.isEmpty() || am == null) {
                report(stopped(id, positionMs, "error"))
                return@post
            }
            if (am.mode == AudioManager.MODE_IN_CALL || am.mode == AudioManager.MODE_IN_COMMUNICATION) {
                // A call has the earpiece; the note stays with the page.
                report(stopped(id, positionMs, "busy"))
                return@post
            }
            val file = File(app.cacheDir, "ear-note")
            try {
                file.writeBytes(bytes)
            } catch (_: Exception) {
                report(stopped(id, positionMs, "error"))
                return@post
            }

            am.mode = AudioManager.MODE_IN_COMMUNICATION
            toEarpiece(am)
            darkenScreen(true)

            val next = ExoPlayer.Builder(app).build()
            next.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_VOICE_COMMUNICATION)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                false
            )
            next.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) finish("ended")
                }

                override fun onPlayerError(error: PlaybackException) {
                    finish("error")
                }
            })
            next.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
            next.setPlaybackSpeed(rate.coerceIn(0.5f, 3f))
            next.prepare()
            if (positionMs > 0) next.seekTo(positionMs)
            next.playWhenReady = true
            player = next
            playingId = id
        }
    }

    /** The page wants the note back (its bubble went away). */
    fun stop() {
        main.post { if (player != null) finish("lowered") }
    }

    /** A new page has loaded: nothing of the old one keeps playing or watching. */
    fun release() {
        main.post {
            stopPlayer()
            if (watching) sensors?.unregisterListener(this)
            watching = false
            near = false
        }
    }

    /** Stops at the ear and tells the page where the note got to. */
    private fun finish(reason: String) {
        val p = player ?: return
        val id = playingId ?: return
        val at = if (reason == "ended") p.duration.coerceAtLeast(0L) else p.currentPosition
        stopPlayer()
        report(stopped(id, at, reason))
    }

    private fun stopPlayer() {
        val p = player ?: return
        player = null
        playingId = null
        try {
            p.stop()
            p.release()
        } catch (_: Exception) {
            // Already gone.
        }
        audio?.let { am ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice()
            am.mode = AudioManager.MODE_NORMAL
        }
        darkenScreen(false)
        File(app.cacheDir, "ear-note").delete()
    }

    private fun toEarpiece(am: AudioManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            am.availableCommunicationDevices
                .firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE }
                ?.let { am.setCommunicationDevice(it) }
        } else {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = false
        }
    }

    /** The screen off against a cheek, as in a call - so a cheek taps nothing. */
    private fun darkenScreen(on: Boolean) {
        val pm = power ?: return
        if (on) {
            if (screenDark?.isHeld == true) return
            if (!pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
            screenDark = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "two:ear-proximity").apply {
                setReferenceCounted(false)
                // A ceiling, in case the note never says it ended.
                acquire(30 * 60 * 1000L)
            }
        } else {
            screenDark?.let {
                if (it.isHeld) it.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
            }
            screenDark = null
        }
    }

    private fun stopped(id: String, positionMs: Long, reason: String): JSONObject =
        JSONObject()
            .put("event", "stopped")
            .put("id", id)
            .put("positionMs", positionMs)
            .put("reason", reason)
}
