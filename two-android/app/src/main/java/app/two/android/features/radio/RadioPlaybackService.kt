package app.two.android.features.radio

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommands
import app.two.android.MainActivity
import app.two.android.R
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.io.IOException

/**
 * Live radio that keeps playing with the screen off and the app in the
 * background.
 *
 * The page used to play the stream itself, which Android may silence once
 * the app is out of sight. Here a native player does it inside a media
 * service: Android keeps it running, and gives it the controls every music
 * app has - play and pause on the lock screen, in the notification, from a
 * Bluetooth headset - and pauses it for a phone call or when headphones are
 * pulled out.
 *
 * The page still decides what plays (see RadioRemote); this only plays it.
 */
@OptIn(UnstableApi::class)
class RadioPlaybackService : MediaSessionService() {

    private var session: MediaSession? = null

    override fun onCreate() {
        super.onCreate()

        // Every address the player fetches is checked - the station's, and
        // each piece an HLS playlist names - and only secure public ones are
        // opened. A station can come from the partner's phone.
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent("Two")
            .setAllowCrossProtocolRedirects(false)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
        val safe = ResolvingDataSource.Factory(http) { spec ->
            if (!RadioUrls.isSafe(spec.uri)) throw RefusedAddress()
            spec
        }

        val player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(
                DefaultMediaSourceFactory(this)
                    .setDataSourceFactory(safe)
                    .setLoadErrorHandlingPolicy(KeepTrying())
            )
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true
            )
            // Headphones pulled out: pause, rather than play out loud.
            .setHandleAudioBecomingNoisy(true)
            // Keeps the CPU and Wi-Fi awake while playing.
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()

        // A live stream left too far behind - after a long gap in the
        // connection - starts again from now, without stopping.
        player.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    player.seekToDefaultPosition()
                    player.prepare()
                }
            }
        })

        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        session = MediaSession.Builder(this, player)
            .setSessionActivity(open)
            .setCallback(Callback())
            .build()

        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this).build().apply {
                setSmallIcon(R.drawable.ic_stat_radio)
            }
        )
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        super.onDestroy()
    }

    private inner class Callback : MediaSession.Callback {

        /**
         * This app may do anything; anything else - the lock screen, the
         * notification shade, a headset, another app - may only play, pause
         * and stop. Without this, any app on the phone could have told the
         * service to fetch any address it liked.
         */
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo
        ): MediaSession.ConnectionResult {
            if (controller.packageName == packageName) return super.onConnect(session, controller)
            val commands = Player.Commands.Builder()
                .addAll(
                    Player.COMMAND_PLAY_PAUSE,
                    Player.COMMAND_STOP,
                    Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
                    Player.COMMAND_GET_METADATA,
                    Player.COMMAND_GET_TIMELINE
                )
                .build()
            return MediaSession.ConnectionResult.accept(SessionCommands.EMPTY, commands)
        }

        /**
         * A station handed over by the app, made playable: its address comes
         * through the request metadata (a media item's own URI is not passed
         * to the session), checked again, and marked HLS where it is one.
         */
        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: MutableList<MediaItem>
        ): ListenableFuture<MutableList<MediaItem>> {
            val playable = mediaItems.mapNotNull { item ->
                val uri: Uri = item.requestMetadata.mediaUri ?: return@mapNotNull null
                if (!RadioUrls.isSafe(uri)) return@mapNotNull null
                val hls = item.requestMetadata.extras?.getBoolean(EXTRA_HLS) == true
                MediaItem.Builder()
                    .setMediaId(item.mediaId)
                    .setUri(uri)
                    .setMimeType(if (hls) MimeTypes.APPLICATION_M3U8 else null)
                    .setMediaMetadata(item.mediaMetadata)
                    .build()
            }.toMutableList()
            return Futures.immediateFuture(playable)
        }
    }

    /** An address the radio will not open (see RadioUrls). */
    private class RefusedAddress : IOException("Refused: not a secure public address")

    /**
     * A dropped connection is tried again inside the player, for as long as
     * it takes: the player stays "buffering", so the service stays a
     * foreground one - which Android lets it become again only while the app
     * is open - and the radio carries on by itself once the phone is back
     * online. (The page still calls a station off air if it stays silent too
     * long.) A station that answers and refuses - not found, forbidden - and
     * an address refused here, are errors at once.
     */
    @OptIn(UnstableApi::class)
    private class KeepTrying : DefaultLoadErrorHandlingPolicy() {

        override fun getMinimumLoadableRetryCount(dataType: Int): Int = Int.MAX_VALUE

        override fun getRetryDelayMsFor(loadErrorInfo: LoadErrorHandlingPolicy.LoadErrorInfo): Long {
            val e = loadErrorInfo.exception
            if (e is RefusedAddress) return C.TIME_UNSET
            if (e is HttpDataSource.InvalidResponseCodeException &&
                e.responseCode in 400..499 && e.responseCode != 408 && e.responseCode != 429
            ) return C.TIME_UNSET
            return super.getRetryDelayMsFor(loadErrorInfo)
        }
    }

    companion object {
        /** Request-metadata extra: the stream is HLS. */
        const val EXTRA_HLS = "two.radio.hls"
    }
}
