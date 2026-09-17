package app.two.android.features.web

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import app.two.android.MainActivity
import app.two.android.R

/**
 * Keeps the microphone working while a call carries on off-screen.
 *
 * Android hands an app that is not on screen a silent microphone. Press the
 * power button mid-call, or switch to another app to look something up, and
 * the other person would go on talking to silence while you still heard
 * them. A foreground service of the microphone type is the one thing that
 * lets a call keep your voice, and Android requires it to show a
 * notification for as long as it runs - the same one the phone's own dialer
 * shows during a call.
 *
 * The notification says a call is happening and nothing about who it is
 * with: it is visible on a lock screen, to anyone holding the phone.
 */
class CallKeepAliveService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        } else {
            0
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
        } catch (e: Exception) {
            // Refused - typically the microphone permission not granted yet, or
            // the app already off screen. The call still works while visible.
            stopSelf()
        }
        // Not restarted if the system kills it: a restarted service would be
        // holding a notification for a call that no longer exists.
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Swiping the app away ends the call with it; the notification goes too.
        stopSelf()
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Calls in progress", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shown while a call is going on, so it keeps working with the screen off."
                    setShowBadge(false)
                    setSound(null, null)
                    enableVibration(false)
                }
            )
        }

        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle("Call in progress")
            .setContentText("Tap to return")
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "two_call_in_progress"
        private const val NOTIFICATION_ID = 4102

        fun start(context: Context) {
            // Android 14 refuses a microphone service to an app without the
            // microphone permission, and a service that was started but could
            // not go foreground crashes the app on some versions. Checked
            // first, so that refusal never happens.
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
            try {
                ContextCompat.startForegroundService(
                    context,
                    Intent(context, CallKeepAliveService::class.java)
                )
            } catch (e: Exception) {
                // Android 12+ refuses to start one from the background. Calls
                // start with the app on screen, so this is the rare race of a
                // call beginning as the app is left.
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CallKeepAliveService::class.java))
        }
    }
}
