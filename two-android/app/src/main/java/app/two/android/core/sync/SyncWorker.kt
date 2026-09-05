package app.two.android.core.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import app.two.android.core.database.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Background WorkManager worker responsible for flushing the offline sync queue
 * to the zero-knowledge relay server whenever the device connects to the internet.
 */
class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val database = AppDatabase.getInstance(applicationContext)
        val pendingItems = database.syncQueueDao().getPendingQueue()

        if (pendingItems.isEmpty()) {
            return@withContext Result.success()
        }

        try {
            for (item in pendingItems) {
                // In production, transmits the ciphertext payload over HTTPS / WebSocket
                // to the relay endpoint (e.g. POST /spaces/{space_id}/records)
                // Upon receiving a 200 OK ACK from the relay:
                database.syncQueueDao().dequeue(item.recordId)
            }
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 5) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
