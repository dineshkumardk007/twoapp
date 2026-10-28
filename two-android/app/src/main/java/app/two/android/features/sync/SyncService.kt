package app.two.android.features.sync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import app.two.android.MainActivity
import app.two.android.R
import app.two.android.features.web.PageShown
import org.json.JSONObject
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * Keeps Two connected while it is in the background, the screen is off, it
 * is locked, or it has been swiped away - so a message of hers gets its two
 * grey ticks when it reaches this phone, not when Two is next opened.
 *
 * It runs for as long as the phone is paired (the room details are stored,
 * BackgroundRoomStore), in one of these modes:
 * - page: the page is alive with its own relay connection on. The service
 *   only keeps the app alive, and wakes the page when the network comes back,
 *   the phone leaves deep sleep, or the quarter-hour alarm ticks - the page's
 *   own timers stop while the phone sleeps.
 * - listener: the page is gone or its relay is off. The native listener
 *   (RelayListener) answers for it, without being able to read anything.
 * - waiting: as listener, but the relay is an older one without receipts, so
 *   nothing connects; it is asked again every six hours.
 * - off: not paired. The service stops.
 *
 * remoteMessaging, not dataSync: Android 15 allows a dataSync service only
 * six hours a day. Android requires a notification for it, and shows it on
 * Android 12 and older: one quiet "Syncing" line, no sound, no heart, hidden
 * on the lock screen. From Android 13 Two never asks for the notification
 * permission for it, so it shows only in the phone's Active apps list.
 *
 * CallKeepAliveService is separate and unchanged: a call keeps its own
 * microphone service and notification.
 */
class SyncService : Service(), RelayListener.Owner {

    /** One thread for every decision and the listener, so none of it races. */
    private val work = ScheduledThreadPoolExecutor(1).apply {
        setExecuteExistingDelayedTasksAfterShutdownPolicy(false)
        setContinueExistingPeriodicTasksAfterShutdownPolicy(false)
    }
    private val main = Handler(Looper.getMainLooper())
    private lateinit var listener: RelayListener

    @Volatile
    private var foreground = false

    @Volatile
    private var ended = false

    // Main thread only.
    private var triggersOn = false
    private var networkWatch: ConnectivityManager.NetworkCallback? = null
    private var idleWatch: BroadcastReceiver? = null

    /** The network callback answers at once when registered; that first answer is not news. */
    private var networkQuietUntil = 0L

    // The work thread only.
    private var mode = SyncMode.OFF
    private var toListener: ScheduledFuture<*>? = null
    private var retry: ScheduledFuture<*>? = null
    private var attempt = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        listener = RelayListener(applicationContext, work, this)
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Started from the boot receiver or the alarm with
        // startForegroundService: a promise to Android to be in the
        // foreground within seconds, which must be kept even when there turns
        // out to be nothing to do, or Android closes the whole app.
        val promised = intent?.getBooleanExtra(EXTRA_PROMISED, false) == true
        val hasRoom = BackgroundRoomStore.room(this) != null
        if (!hasRoom && !promised) {
            stopSelf()
            return START_NOT_STICKY
        }
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
        } else {
            0
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
            foreground = true
        } catch (e: Exception) {
            // Refused - Two already in the background on Android 12 and
            // later, or its battery set to Restricted. The room stays stored,
            // and the next time Two is opened it starts again.
            Log.w(TAG, "Not allowed to run in the background just now", e)
            foreground = false
            stopSelf()
            return START_NOT_STICKY
        }
        if (!hasRoom) {
            stopNow()
            return START_NOT_STICKY
        }
        registerTriggers()
        SyncAlarm.arm(this)
        evaluate()
        // Started again if Android has to end it; with nothing stored it
        // stops itself straight away.
        return START_STICKY
    }

    /**
     * Swiped away. The service carries on, and the page - destroyed with the
     * Activity - hands over to the listener.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        PageHost.closed(this)
    }

    override fun onDestroy() {
        ended = true
        if (instance === this) instance = null
        currentMode = SyncMode.OFF
        foreground = false
        unregisterTriggers()
        SyncAlarm.cancel(this)
        try {
            work.execute {
                toListener?.cancel(false)
                retry?.cancel(false)
                listener.close()
            }
        } catch (_: RejectedExecutionException) {
            // Already shut.
        }
        work.shutdown()
        WakeLocks.release(SYNC_TAG)
        WakeLocks.release(LISTEN_TAG)
        super.onDestroy()
    }

    /** Looks again at what should be connected. Any thread. */
    private fun evaluate() {
        post { decide() }
    }

    private fun target(): SyncMode = pickMode(
        hasRoom = BackgroundRoomStore.room(this) != null,
        pageAlive = PageHost.alive,
        pageRelayOn = PageHost.relayOn,
        oldRelay = BackgroundRoomStore.receipts(this, System.currentTimeMillis()) == Receipts.OLD
    )

    /** The work thread. */
    private fun decide() {
        if (ended) return
        when (target()) {
            SyncMode.OFF -> shutDown()
            SyncMode.PAGE -> settle(SyncMode.PAGE)
            SyncMode.WAITING -> settle(SyncMode.WAITING)
            SyncMode.LISTENER -> if (mode != SyncMode.LISTENER) {
                // A lock reloads the page: its relay goes off, then on again
                // after the PIN. Waiting a moment before taking over means a
                // quick unlock never sees the listener connect at all.
                if (toListener == null) {
                    WakeLocks.hold(this, SYNC_TAG, HAND_OVER_MS + 2_000L)
                    toListener = work.schedule(Runnable {
                        toListener = null
                        confirmListener()
                    }, HAND_OVER_MS, TimeUnit.MILLISECONDS)
                }
            } else if (!listener.busy && retry == null) {
                connectNow()
            }
        }
    }

    /** Page or waiting: no listener, and nothing pending to start one. */
    private fun settle(next: SyncMode) {
        toListener?.cancel(false)
        toListener = null
        retry?.cancel(false)
        retry = null
        listener.close()
        setMode(next)
    }

    private fun confirmListener() {
        if (ended) return
        if (target() != SyncMode.LISTENER) {
            decide()
            return
        }
        setMode(SyncMode.LISTENER)
        attempt = 0
        connectNow()
    }

    private fun connectNow() {
        retry?.cancel(false)
        retry = null
        if (ended || mode != SyncMode.LISTENER) return
        val room = BackgroundRoomStore.room(this) ?: return decide()
        when (BackgroundRoomStore.receipts(this, System.currentTimeMillis())) {
            Receipts.OK -> listener.open(room)
            Receipts.CHECK -> listener.checkHealth(room.healthUrl) { answer -> healthAnswered(answer) }
            Receipts.OLD -> decide()
        }
    }

    private fun healthAnswered(answer: Boolean?) {
        if (ended) return
        if (answer == null) {
            scheduleRetry(handOver = false)
            return
        }
        BackgroundRoomStore.setReceipts(this, answer, System.currentTimeMillis())
        if (answer) connectNow() else decide()
    }

    override fun onJoined() {
        attempt = 0
    }

    override fun onEnded(code: Int) {
        if (ended || mode != SyncMode.LISTENER) return
        // 4000: the page joined and replaced it. 4001: the relay still has
        // the page's connection - a page that has just gone, whose socket
        // the relay drops within a minute. Either way, slowly.
        scheduleRetry(handOver = code == 4000 || code == 4001)
    }

    override fun onOldRelay() {
        BackgroundRoomStore.setReceipts(this, false, System.currentTimeMillis())
        decide()
    }

    private fun scheduleRetry(handOver: Boolean) {
        retry?.cancel(false)
        val delay = if (handOver) ListenerBackoff.handOverMs(attempt) else ListenerBackoff.failureMs(attempt)
        attempt++
        retry = work.schedule(Runnable {
            retry = null
            // Never again while the page has its own connection.
            if (mode == SyncMode.LISTENER && target() == SyncMode.LISTENER) connectNow() else decide()
        }, delay, TimeUnit.MILLISECONDS)
    }

    /** Not paired any more: everything stops, the notification goes. */
    private fun shutDown() {
        settle(SyncMode.OFF)
        main.post {
            unregisterTriggers()
            SyncAlarm.cancel(this)
            stopNow()
        }
    }

    private fun stopNow() {
        foreground = false
        try {
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {
            // Not in the foreground.
        }
        stopSelf()
    }

    private fun setMode(next: SyncMode) {
        mode = next
        currentMode = next
    }

    /*
     * What wakes it: the network coming back or changing, the phone leaving
     * deep sleep, and the quarter-hour alarm (SyncAlarm). Each holds the phone
     * awake for ten seconds, long enough to check a connection or make one.
     */

    private fun registerTriggers() {
        if (triggersOn) return
        triggersOn = true
        try {
            val connectivity = getSystemService(ConnectivityManager::class.java)
            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    if (SystemClock.elapsedRealtime() < networkQuietUntil) return
                    trigger(Trigger.NETWORK)
                }
            }
            networkQuietUntil = SystemClock.elapsedRealtime() + 2_000L
            connectivity?.registerDefaultNetworkCallback(callback)
            networkWatch = callback
        } catch (e: Exception) {
            Log.w(TAG, "No network callback", e)
        }
        try {
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val power = this@SyncService.getSystemService(PowerManager::class.java)
                    if (power?.isDeviceIdleMode == false) trigger(Trigger.WAKE)
                }
            }
            // Exported, because only the system sends it (as for the screen
            // events in TwoWebView): not-exported would ask the sender for
            // Two's own permission on Android 12 and older.
            ContextCompat.registerReceiver(
                this,
                receiver,
                IntentFilter(PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED),
                ContextCompat.RECEIVER_EXPORTED
            )
            idleWatch = receiver
        } catch (e: Exception) {
            Log.w(TAG, "No deep-sleep receiver", e)
        }
    }

    private fun unregisterTriggers() {
        triggersOn = false
        networkWatch?.let { callback ->
            try {
                getSystemService(ConnectivityManager::class.java)?.unregisterNetworkCallback(callback)
            } catch (_: Exception) {
                // Never registered.
            }
        }
        networkWatch = null
        idleWatch?.let { receiver ->
            try {
                unregisterReceiver(receiver)
            } catch (_: Exception) {
                // Already gone.
            }
        }
        idleWatch = null
    }

    private fun trigger(kind: Trigger) {
        WakeLocks.hold(this, SYNC_TAG, 10_000L)
        post { onTrigger(kind) }
    }

    /** The work thread. */
    private fun onTrigger(kind: Trigger) {
        if (ended) return
        when (mode) {
            SyncMode.PAGE -> PageHost.wake()
            SyncMode.LISTENER -> when {
                listener.connected -> listener.checkAlive()
                !listener.busy -> {
                    // A network that came back is worth trying at once, not
                    // after the backoff built up while there was none.
                    if (kind == Trigger.NETWORK) attempt = 0
                    connectNow()
                }
            }
            // Asks the relay again once its answer is six hours old.
            SyncMode.WAITING, SyncMode.OFF -> decide()
        }
    }

    private fun post(block: () -> Unit) {
        if (ended) return
        try {
            work.execute { block() }
        } catch (_: RejectedExecutionException) {
            // Shut down.
        }
    }

    private fun buildNotification(): Notification {
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, getString(R.string.sync_channel), NotificationManager.IMPORTANCE_MIN).apply {
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
                enableLights(false)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
        )

        val open = PendingIntent.getActivity(
            this,
            1,
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_sync)
            .setContentTitle(getString(R.string.sync_title))
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_DEFERRED)
            .build()
    }

    companion object {
        private const val TAG = "TwoSync"
        private const val CHANNEL_ID = "two_sync"
        private const val NOTIFICATION_ID = 4103
        private const val EXTRA_PROMISED = "promised"
        private const val HAND_OVER_MS = 3_000L

        /** Wake-lock tags: the service's triggers, the listener's answers, the page's own work. */
        const val SYNC_TAG = "two:sync"
        const val LISTEN_TAG = "two:listen"
        const val PAGE_TAG = "two:page"

        @Volatile
        private var instance: SyncService? = null

        @Volatile
        private var currentMode = SyncMode.OFF

        /** Running in the foreground right now. */
        val running: Boolean get() = instance?.foreground == true

        /** Something the modes depend on changed (PageHost, the room). A no-op while not running. */
        @Suppress("UNUSED_PARAMETER")
        fun evaluate(context: Context) {
            instance?.evaluate()
        }

        /**
         * An ordinary start, from the bridge while Two is on screen - which
         * is when Android lets the service come to the foreground. Not
         * startForegroundService: see CallKeepAliveService.start.
         */
        fun start(context: Context) {
            try {
                context.startService(Intent(context, SyncService::class.java))
            } catch (e: Exception) {
                // Two had already left the screen; the next page open tries again.
                Log.w(TAG, "Could not start", e)
            }
        }

        /** From the background, where only startForegroundService is allowed (boot, the alarm). */
        fun startPromised(context: Context) {
            try {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, SyncService::class.java).putExtra(EXTRA_PROMISED, true)
                )
            } catch (e: Exception) {
                // Android 12 and later refuse it without the battery
                // exemption; Two starts it again when next opened.
                Log.w(TAG, "Could not start from the background", e)
            }
        }

        /** The quarter-hour tick (SyncAlarm). */
        fun alarm(context: Context) {
            val app = context.applicationContext
            val service = instance
            if (service != null) {
                SyncAlarm.arm(app)
                service.trigger(Trigger.ALARM)
            } else if (BackgroundRoomStore.room(app) != null) {
                // Android ended the service but left the alarm: start again.
                WakeLocks.hold(app, SYNC_TAG, 10_000L)
                startPromised(app)
            }
        }

        /**
         * The page's room details (AndroidWebBridge.backgroundRoomSet). True
         * when they were good and stored.
         */
        fun roomSet(context: Context, json: String?): Boolean {
            val app = context.applicationContext
            val input = BackgroundRoomStore.parseInput(json, app.getString(R.string.notice_default)) ?: return false
            BackgroundRoomStore.save(app, input)
            if (input.disguised) NewMessageNotice.cancel(app)
            if (!PageShown.away && instance == null) start(app) else evaluate(app)
            return true
        }

        /**
         * Unpair, Start fresh, the erase: the room details go, every key of
         * them, and so does the listener, the alarm, the notice and the
         * service. Nothing joins the room after this.
         */
        fun clear(context: Context) {
            val app = context.applicationContext
            BackgroundRoomStore.clear(app)
            NewMessageNotice.cancel(app)
            SyncAlarm.cancel(app)
            // With no room, the service's own look closes the listener (1000)
            // and stops; stopping it as well makes sure.
            instance?.evaluate()
            try {
                app.stopService(Intent(app, SyncService::class.java))
            } catch (_: Exception) {
                // Not running.
            }
        }

        /** For the page's Settings and one-time cards (AndroidWebBridge.backgroundState). */
        fun state(context: Context): String {
            val app = context.applicationContext
            return JSONObject()
                .put("running", running)
                .put("mode", if (instance == null) SyncMode.OFF.wire else currentMode.wire)
                .put("hasRoom", BackgroundRoomStore.room(app) != null)
                .put("ignoringBattery", OemSettings.isIgnoringBattery(app))
                .put("restricted", OemSettings.isRestricted(app))
                .put("oem", OemSettings.phoneFamily())
                .put("notify", BackgroundRoomStore.notify(app))
                .put("noticeAllowed", NewMessageNotice.allowed(app))
                .put("sdk", Build.VERSION.SDK_INT)
                .toString()
        }
    }
}

/** What the service is doing; [wire] is how the page hears it (backgroundState). */
internal enum class SyncMode(val wire: String) {
    OFF("off"),
    PAGE("page"),
    LISTENER("listener"),
    WAITING("waiting")
}

private enum class Trigger { NETWORK, WAKE, ALARM }

/**
 * Not paired: off. The page alive with its relay on: the page does it. An
 * older relay without receipts: wait. Otherwise the listener.
 */
internal fun pickMode(hasRoom: Boolean, pageAlive: Boolean, pageRelayOn: Boolean, oldRelay: Boolean): SyncMode = when {
    !hasRoom -> SyncMode.OFF
    pageAlive && pageRelayOn -> SyncMode.PAGE
    oldRelay -> SyncMode.WAITING
    else -> SyncMode.LISTENER
}

/** How long the listener waits before connecting again. */
internal object ListenerBackoff {
    private const val CAP_MS = 5 * 60 * 1000L
    private val HAND_OVER_MS = longArrayOf(5_000L, 15_000L, 30_000L, 60_000L)

    /**
     * After 4000 or 4001 - the page's connection is, or was just, there:
     * 5 s, 15 s, 30 s, a minute, then every five minutes.
     */
    fun handOverMs(attempt: Int): Long = HAND_OVER_MS.getOrElse(attempt.coerceAtLeast(0)) { CAP_MS }

    /** After any other end: from a second, doubling, to five minutes. */
    fun failureMs(attempt: Int): Long = min(1_000L shl attempt.coerceIn(0, 9), CAP_MS)
}

/**
 * Partial wake locks by tag, one each and not counted: holding one again only
 * moves its end. Each always has an end, so none can keep the phone awake for
 * good.
 */
internal object WakeLocks {
    private val locks = HashMap<String, PowerManager.WakeLock>()

    @Synchronized
    fun hold(context: Context, tag: String, ms: Long) {
        try {
            val lock = locks.getOrPut(tag) {
                val power = context.applicationContext.getSystemService(PowerManager::class.java)
                    ?: return
                power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, tag).apply { setReferenceCounted(false) }
            }
            lock.acquire(ms)
        } catch (_: Exception) {
            // A phone that will not lend one: the work may wait for the next wake.
        }
    }

    @Synchronized
    fun release(tag: String) {
        try {
            locks[tag]?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {
            // Already let go.
        }
    }
}
