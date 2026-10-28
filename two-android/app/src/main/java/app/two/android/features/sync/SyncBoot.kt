package app.two.android.features.sync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Starts the background connection again after the phone restarts, or after
 * Two is updated (which ends the running app). Only when this phone is
 * paired: an unpaired or wiped phone has no room, and nothing starts.
 *
 * Both broadcasts let an app start a foreground service from the
 * background, and remoteMessaging is not among the types Android 15 refuses
 * after a restart.
 */
class SyncBoot : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        val app = context?.applicationContext ?: return
        val action = intent?.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (BackgroundRoomStore.room(app) == null) return
        SyncService.startPromised(app)
    }
}
