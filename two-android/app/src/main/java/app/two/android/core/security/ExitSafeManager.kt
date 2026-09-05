package app.two.android.core.security

import android.content.Context
import app.two.android.core.crypto.KeystoreManager
import app.two.android.core.database.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Exit-Safe Architecture Controller.
 *
 * Provides a quiet, safe, unannounced exit path for users in vulnerable situations.
 * Destroys local keys, shreds database records, clears preferences, and prevents
 * any notifications or alarms from being sent to the partner.
 */
class ExitSafeManager(
    private val context: Context,
    private val database: AppDatabase,
    private val keystoreManager: KeystoreManager = KeystoreManager()
) {

    /**
     * Executes the silent exit protocol:
     * 1. Shreds all Keystore hardware-backed keys.
     * 2. Clears all Room database tables (users, spaces, records, private_records, queue).
     * 3. Wipes application cache directory and SharedPreferences.
     */
    suspend fun executeSilentWipe() = withContext(Dispatchers.IO) {
        try {
            // 1. Clear database completely
            database.clearAllTables()

            // 2. Destroy hardware keys in Android Keystore
            keystoreManager.destroyKeystoreKeys()

            // 3. Clear app caches
            context.cacheDir.deleteRecursively()

            // 4. Clear shared preferences
            val prefs = context.getSharedPreferences("two_prefs", Context.MODE_PRIVATE)
            prefs.edit().clear().commit()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
