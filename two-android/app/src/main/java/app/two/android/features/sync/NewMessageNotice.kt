package app.two.android.features.sync

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.two.android.MainActivity
import app.two.android.R
import app.two.android.features.web.PageShown

/**
 * The optional "New message" notice while Two is closed: off until the person
 * turns it on in Settings.
 *
 * It says only the words the page gave it ("New message", in her language) -
 * never who, never what, no number and no sound. Every message shares the
 * one notice, so ten messages are still one line. Never while the calculator
 * disguise is on, and gone the moment Two is opened.
 *
 * Turning it on is the only thing in Two that asks for the notification
 * permission on Android 13 and later; without it the background connection
 * shows nowhere but the phone's Active apps list.
 */
object NewMessageNotice {
    const val NOTIFICATION_ID = 4104

    /** The permission request's code; MainActivity hands the answer back here. */
    const val ASK_CODE = 4105

    private const val CHANNEL_ID = "two_notice"

    /** Main thread only: who is waiting for the permission prompt's answer. */
    private var waiting: (() -> Unit)? = null

    /** The runtime permission, which only Android 13 and later have. */
    fun permissionHeld(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    /** Whether a notice would show at all: the permission, and Two's notifications not turned off. */
    fun allowed(context: Context): Boolean =
        permissionHeld(context) && NotificationManagerCompat.from(context).areNotificationsEnabled()

    /** Main thread. Shows Android's prompt; [answered] runs when it is closed. */
    fun ask(activity: Activity, answered: () -> Unit) {
        waiting = answered
        try {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), ASK_CODE)
        } catch (_: Exception) {
            waiting = null
            answered()
        }
    }

    /** Main thread: the prompt was answered (MainActivity.onRequestPermissionsResult). */
    fun asked() {
        val answered = waiting
        waiting = null
        answered?.invoke()
    }

    /** The page heard a message of hers while Two is out of sight. */
    fun fromPage(context: Context) {
        if (PageShown.away) post(context)
    }

    /**
     * The listener heard one. Not while the locked page is on screen - the
     * PIN screen is still Two in front of her.
     */
    fun fromListener(context: Context) {
        if (PageShown.away || !PageHost.alive) post(context)
    }

    private fun post(context: Context) {
        val app = context.applicationContext
        if (!BackgroundRoomStore.notify(app)) return
        val room = BackgroundRoomStore.room(app) ?: return
        if (room.disguised) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val manager = app.getSystemService(NotificationManager::class.java) ?: return
        if (!manager.areNotificationsEnabled()) return
        try {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, app.getString(R.string.notice_channel), NotificationManager.IMPORTANCE_LOW).apply {
                    setShowBadge(false)
                    setSound(null, null)
                    enableVibration(false)
                }
            )
            val title = room.noticeText.ifBlank { app.getString(R.string.notice_default) }
            // The lock-screen copy is the same notice: there is nothing in it
            // to hide, and Android would otherwise show "Contents hidden",
            // which says more than "New message" does.
            val notice = builder(app, title).setPublicVersion(builder(app, title).build()).build()
            manager.notify(NOTIFICATION_ID, notice)
        } catch (_: Exception) {
            // A phone that will not take it: no notice, which is the default anyway.
        }
    }

    private fun builder(context: Context, title: String): NotificationCompat.Builder {
        val open = PendingIntent.getActivity(
            context,
            2,
            Intent(context, MainActivity::class.java).addFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            ),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notice)
            .setContentTitle(title)
            .setContentIntent(open)
            .setShowWhen(false)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
    }

    fun cancel(context: Context) {
        try {
            context.applicationContext.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
        } catch (_: Exception) {
            // Not showing.
        }
    }
}
