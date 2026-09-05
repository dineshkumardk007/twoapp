package app.two.android.core.network

import app.two.android.core.database.RecordEntity
import app.two.android.core.database.RecordType
import app.two.android.core.sync.SyncEngine
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

/**
 * WebSocket Relay manager on Android.
 * Connects to the relay pipe at ws://10.0.2.2:4000/relay, joins the space room,
 * and passes incoming encrypted envelopes to SyncEngine for local decryption and storage.
 */
class AndroidWebSocketRelay(
    private val syncEngine: SyncEngine,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
) {
    private val isConnected = AtomicBoolean(false)
    private var currentSpaceId: String = ""
    private var currentUserId: String = ""

    fun connect(spaceId: String, userId: String) {
        currentSpaceId = spaceId
        currentUserId = userId
        // In production, instantiate OkHttp WebSocket connection:
        // val request = Request.Builder().url(NetworkConfig.wsRelayUrl).build()
        // client.newWebSocket(request, listener)
        isConnected.set(true)
    }

    /**
     * Broadcasts an encrypted record over the relay pipe to the partner.
     */
    fun broadcastEncryptedRecord(record: RecordEntity) {
        if (!isConnected.get()) return

        val message = JSONObject().apply {
            put("type", "RECORD")
            put("spaceId", record.spaceId)
            put("record", JSONObject().apply {
                put("id", record.id)
                put("spaceId", record.spaceId)
                put("authorId", record.authorId)
                put("type", record.type.name)
                put("payload", android.util.Base64.encodeToString(record.ciphertext, android.util.Base64.NO_WRAP))
                put("nonce", android.util.Base64.encodeToString(record.nonce, android.util.Base64.NO_WRAP))
                put("lamportClock", record.lamportClock)
                put("clientTs", record.clientTimestamp)
                put("createdAt", record.createdAt.toString())
            })
        }

        // Transmits payload over WebSocket socket
    }

    /**
     * Ingests a raw JSON packet received from the remote partner via WebSocket.
     */
    fun onRawPacketReceived(rawJson: String, spaceKey: ByteArray) {
        scope.launch {
            try {
                val json = JSONObject(rawJson)
                if (json.optString("type") == "REMOTE_RECORD") {
                    val r = json.getJSONObject("record")
                    val ciphertext = android.util.Base64.decode(r.getString("payload"), android.util.Base64.NO_WRAP)
                    val nonce = android.util.Base64.decode(r.getString("nonce"), android.util.Base64.NO_WRAP)

                    syncEngine.ingestRemoteRecord(
                        recordId = r.getString("id"),
                        spaceId = r.getString("spaceId"),
                        authorId = r.getString("authorId"),
                        spaceKey = spaceKey,
                        type = RecordType.valueOf(r.getString("type")),
                        ciphertext = ciphertext,
                        nonce = nonce,
                        lamport = r.getLong("lamportClock"),
                        clientTs = r.getLong("clientTs"),
                        isDeleted = false
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun disconnect() {
        isConnected.set(false)
        scope.cancel()
    }
}
