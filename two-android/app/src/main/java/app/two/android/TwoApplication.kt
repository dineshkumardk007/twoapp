package app.two.android

import android.app.Application
import androidx.work.*
import app.two.android.core.crypto.KeystoreManager
import app.two.android.core.database.AppDatabase
import app.two.android.core.sync.SyncEngine
import app.two.android.core.sync.SyncWorker
import java.util.concurrent.TimeUnit

class TwoApplication : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var keystoreManager: KeystoreManager
        private set

    lateinit var syncEngine: SyncEngine
        private set

    override fun onCreate() {
        super.onCreate()

        // 1. Initialize encrypted database and hardware keystore
        database = AppDatabase.getInstance(this)
        keystoreManager = KeystoreManager()
        syncEngine = SyncEngine(database)
        app.two.android.core.network.NetworkConfig.init(this)

        // 2. Schedule periodic background synchronization with network constraints
        schedulePeriodicSync()
    }

    private fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "two_sync_worker",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
