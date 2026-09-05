package app.two.android.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface RecordDao {
    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND isDeleted = 0 ORDER BY lamportClock ASC")
    fun observeAllRecords(spaceId: String): Flow<List<RecordEntity>>

    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND type = :type AND isDeleted = 0 ORDER BY lamportClock DESC")
    fun observeRecordsByType(spaceId: String, type: RecordType): Flow<List<RecordEntity>>

    @Query("SELECT * FROM records WHERE id = :id LIMIT 1")
    suspend fun getRecordById(id: String): RecordEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(record: RecordEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(records: List<RecordEntity>)

    @Query("UPDATE records SET isDeleted = 1, syncStatus = :syncStatus WHERE id = :id")
    suspend fun softDeleteRecord(id: String, syncStatus: SyncStatus = SyncStatus.PENDING_DELETE)

    @Query("DELETE FROM records WHERE id = :id")
    suspend fun hardDeleteRecord(id: String)

    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND type = 'CHAT' AND isDeleted = 0 ORDER BY lamportClock ASC")
    fun observeChatMessages(spaceId: String): Flow<List<RecordEntity>>

    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND type = 'MOOD' AND isDeleted = 0 ORDER BY clientTimestamp DESC LIMIT 1")
    fun observeLatestMood(spaceId: String): Flow<RecordEntity?>

    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND type = 'AGREEMENT' AND isDeleted = 0 ORDER BY clientTimestamp DESC")
    fun observeAgreements(spaceId: String): Flow<List<RecordEntity>>

    @Query("SELECT * FROM records WHERE spaceId = :spaceId AND type = 'AGREEMENT' AND plaintext LIKE '%' || :query || '%' AND isDeleted = 0")
    suspend fun searchAgreements(spaceId: String, query: String): List<RecordEntity>
}

@Dao
interface PrivateRecordDao {
    @Query("SELECT * FROM private_records WHERE spaceId = :spaceId ORDER BY createdAt DESC")
    fun observePrivateRecords(spaceId: String): Flow<List<PrivateRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(record: PrivateRecordEntity)

    @Query("DELETE FROM private_records WHERE id = :id")
    suspend fun delete(id: String)
}

@Dao
interface SpaceDao {
    @Query("SELECT * FROM spaces LIMIT 1")
    fun observeActiveSpace(): Flow<SpaceEntity?>

    @Query("SELECT * FROM spaces LIMIT 1")
    suspend fun getActiveSpace(): SpaceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSpace(space: SpaceEntity)

    @Query("DELETE FROM spaces")
    suspend fun clearSpaces()
}

@Dao
interface ConsentDao {
    @Query("SELECT * FROM consent_events WHERE spaceId = :spaceId ORDER BY timestamp DESC")
    fun observeConsentEvents(spaceId: String): Flow<List<ConsentEventEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun logEvent(event: ConsentEventEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue ORDER BY timestamp ASC")
    suspend fun getPendingQueue(): List<SyncQueueEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueue(item: SyncQueueEntity)

    @Query("DELETE FROM sync_queue WHERE recordId = :recordId")
    suspend fun dequeue(recordId: String)

    @Query("DELETE FROM sync_queue")
    suspend fun clearQueue()
}
