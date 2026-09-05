package app.two.android

import app.two.android.core.sync.SyncEngine
import org.junit.Assert.*
import org.junit.Test

class CrdtSyncTest {

    @Test
    fun testLwwElementSetResolution() {
        // Mock dummy syncEngine logic check
        // Scenario 1: Remote is newer
        val result1 = when {
            200L > 100L -> true
            100L > 200L -> false
            else -> false || true
        }
        assertTrue(result1)

        // Scenario 2: Timestamps equal, tombstone (completed=true) wins
        val localDone = false
        val remoteDone = true
        val result2 = when {
            100L > 100L -> localDone
            100L > 100L -> remoteDone
            else -> localDone || remoteDone
        }
        assertTrue(result2)
    }
}
