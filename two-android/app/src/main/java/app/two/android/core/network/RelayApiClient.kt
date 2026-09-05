package app.two.android.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/**
 * Native lightweight HTTP client for communicating with Two's zero-knowledge relay backend.
 * Operates without heavy third-party networking dependencies.
 */
class RelayApiClient {

    private fun openConnection(endpoint: String, method: String): HttpURLConnection {
        val url = URL("${NetworkConfig.httpBaseUrl}$endpoint")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        return conn
    }

    suspend fun checkHealth(): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = openConnection("/health", "GET")
            conn.connect()
            conn.responseCode == 200
        } catch (e: Exception) {
            false
        }
    }

    suspend fun registerUser(
        userId: String,
        authId: String,
        publicKey: ByteArray,
        encryptedPrivateKey: ByteArray
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = openConnection("/auth/register", "POST")
            conn.doOutput = true

            val json = JSONObject().apply {
                put("id", userId)
                put("authId", authId)
                put("publicKey", android.util.Base64.encodeToString(publicKey, android.util.Base64.NO_WRAP))
                put("encryptedPrivateKey", android.util.Base64.encodeToString(encryptedPrivateKey, android.util.Base64.NO_WRAP))
            }

            OutputStreamWriter(conn.outputStream).use { it.write(json.toString()) }
            conn.responseCode in 200..201
        } catch (e: Exception) {
            false
        }
    }

    suspend fun pushCiphertextRecords(recordsJson: JSONArray): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = openConnection("/sync/push", "POST")
            conn.doOutput = true

            val body = JSONObject().apply {
                put("records", recordsJson)
            }

            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
            conn.responseCode == 200
        } catch (e: Exception) {
            false
        }
    }

    suspend fun pullCiphertextRecords(spaceId: String, sinceLamport: Long): String? = withContext(Dispatchers.IO) {
        try {
            val conn = openConnection("/sync/pull/$spaceId?since=$sinceLamport", "GET")
            if (conn.responseCode == 200) {
                BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
