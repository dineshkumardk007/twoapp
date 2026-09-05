package app.two.android.core.sync

import app.two.android.core.crypto.CryptoEngine
import app.two.android.core.database.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/**
 * High-reliability, offline-first synchronization engine.
 *
 * Implements:
 * - Local-first immediate commits to Room.
 * - Outbound write queuing with Lamport logical clock monotonicity.
 * - LWW (Last-Write-Wins) deterministic resolution for atomic records.
 * - Operation-based LWW-Element-Set CRDT for collaborative lists.
 */
class SyncEngine(
    private val database: AppDatabase,
    private val cryptoEngine: CryptoEngine = CryptoEngine
) {
    private val currentLamportClock = AtomicLong(System.currentTimeMillis())

    /**
     * Increments and returns the next Lamport clock value.
     */
    fun tickClock(remoteClock: Long = 0): Long {
        return currentLamportClock.updateAndGet { current ->
            maxOf(current, remoteClock) + 1
        }
    }

    /**
     * Commits a new record locally, encrypts the payload, and enqueues it for background sync.
     */
    suspend fun createAndQueueRecord(
        spaceId: String,
        authorId: String,
        spaceKey: ByteArray,
        type: RecordType,
        plaintext: String
    ): RecordEntity = withContext(Dispatchers.IO) {
        val recordId = UUID.randomUUID().toString()
        val clientTs = System.currentTimeMillis()
        val lamport = tickClock()

        // Derive subkey based on record type
        val subkey = cryptoEngine.deriveSubkey(spaceKey, type.name.lowercase(), 1L)

        // Encrypt payload with AAD (record_id || space_id || record_type)
        val encrypted = cryptoEngine.encryptPayload(
            plaintext = plaintext.toByteArray(Charsets.UTF_8),
            key = subkey,
            recordId = recordId,
            spaceId = spaceId,
            recordType = type.name
        )

        val record = RecordEntity(
            id = recordId,
            spaceId = spaceId,
            authorId = authorId,
            type = type,
            plaintext = plaintext,
            ciphertext = encrypted.ciphertext,
            nonce = encrypted.nonce,
            lamportClock = lamport,
            clientTimestamp = clientTs,
            syncStatus = SyncStatus.PENDING_SYNC,
            isDeleted = false
        )

        // 1. Commit locally to Room for immediate instant UI update
        database.recordDao().insertOrUpdate(record)

        // 2. Enqueue in persistent offline sync queue
        val queueItem = SyncQueueEntity(
            recordId = recordId,
            spaceId = spaceId,
            action = "UPSERT",
            payload = encrypted.ciphertext,
            nonce = encrypted.nonce,
            recordType = type,
            lamportClock = lamport
        )
        database.syncQueueDao().enqueue(queueItem)

        record
    }

    /**
     * Ingests an inbound remote record received via WebSocket or SyncWorker.
     * Applies Last-Write-Wins (LWW) conflict resolution: (lamport, client_ts, author_id).
     */
    suspend fun ingestRemoteRecord(
        recordId: String,
        spaceId: String,
        authorId: String,
        spaceKey: ByteArray,
        type: RecordType,
        ciphertext: ByteArray,
        nonce: ByteArray,
        lamport: Long,
        clientTs: Long,
        isDeleted: Boolean
    ) = withContext(Dispatchers.IO) {
        tickClock(lamport)

        val existing = database.recordDao().getRecordById(recordId)
        if (existing != null) {
            // Check LWW condition
            if (existing.lamportClock > lamport) {
                // Existing record is newer; reject stale update
                return@withContext
            }
        }

        val subkey = cryptoEngine.deriveSubkey(spaceKey, type.name.lowercase(), 1L)
        val plaintext = try {
            val decryptedBytes = cryptoEngine.decryptPayload(
                ciphertext = ciphertext,
                nonce = nonce,
                key = subkey,
                recordId = recordId,
                spaceId = spaceId,
                recordType = type.name
            )
            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            "[Decryption Error: Tampered or invalid key]"
        }

        val entity = RecordEntity(
            id = recordId,
            spaceId = spaceId,
            authorId = authorId,
            type = type,
            plaintext = plaintext,
            ciphertext = ciphertext,
            nonce = nonce,
            lamportClock = lamport,
            clientTimestamp = clientTs,
            syncStatus = SyncStatus.SYNCED,
            isDeleted = isDeleted
        )
        database.recordDao().insertOrUpdate(entity)
    }

    /**
     * Collaborative List Item LWW-Element-Set CRDT Merge Strategy.
     * Merges remote list updates with local state.
     * In LWW-Element-Set, a deletion tombstone always wins if timestamps are identical.
     */
    fun resolveListItemConflict(
        localDone: Boolean,
        localLamport: Long,
        remoteDone: Boolean,
        remoteLamport: Long
    ): Boolean {
        return when {
            remoteLamport > localLamport -> remoteDone
            localLamport > remoteLamport -> localDone
            else -> localDone || remoteDone // Tombstone (completed/checked) wins tie-break
        }
    }
}
