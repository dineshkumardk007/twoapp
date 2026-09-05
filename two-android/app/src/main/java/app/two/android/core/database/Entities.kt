package app.two.android.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

enum class SyncStatus {
    SYNCED,
    PENDING_SYNC,
    PENDING_DELETE,
    FAILED
}

enum class RecordType {
    CHAT,
    JOURNAL,
    MOOD,
    MEMORY,
    EVENT,
    LIST_ITEM,
    AGREEMENT,
    APPRECIATION,
    CAPSULE,
    QUOTE,
    EXPENSE,
    GOAL
}

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val authId: String,
    val publicKey: ByteArray,
    val encryptedPrivateKey: ByteArray,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "spaces")
data class SpaceEntity(
    @PrimaryKey val id: String,
    val name: String,
    val partnerName: String,
    val spaceKey: ByteArray, // Wrapped under Android Keystore key
    val settingsPayload: ByteArray,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "records",
    indices = [
        Index(value = ["spaceId", "lamportClock"]),
        Index(value = ["spaceId", "type"]),
        Index(value = ["syncStatus"])
    ]
)
data class RecordEntity(
    @PrimaryKey val id: String,
    val spaceId: String,
    val authorId: String,
    val type: RecordType,
    val plaintext: String, // Decrypted local cache copy for fast UI render & Room search
    val ciphertext: ByteArray,
    val nonce: ByteArray,
    val lamportClock: Long,
    val clientTimestamp: Long,
    val syncStatus: SyncStatus = SyncStatus.SYNCED,
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "private_records",
    indices = [Index(value = ["ownerId", "spaceId"])]
)
data class PrivateRecordEntity(
    @PrimaryKey val id: String,
    val ownerId: String,
    val spaceId: String,
    val plaintext: String,
    val ciphertext: ByteArray,
    val nonce: ByteArray,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "consent_events",
    indices = [Index(value = ["spaceId", "timestamp"])]
)
data class ConsentEventEntity(
    @PrimaryKey val id: String,
    val spaceId: String,
    val actorId: String,
    val kind: String, // "location", "cycle", "export", "ai_refinement"
    val action: String, // "grant", "revoke", "access"
    val details: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey val recordId: String,
    val spaceId: String,
    val action: String, // "UPSERT", "DELETE"
    val payload: ByteArray,
    val nonce: ByteArray,
    val recordType: RecordType,
    val lamportClock: Long,
    val timestamp: Long = System.currentTimeMillis(),
    val retryCount: Int = 0
)
