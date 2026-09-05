package app.two.android

import app.two.android.core.crypto.SafetyNumberGenerator
import org.junit.Assert.*
import org.junit.Test

class SafetyNumberTest {

    @Test
    fun testSafetyNumberSymmetry() {
        val pubKeyA = ByteArray(32) { 0x10 }
        val pubKeyB = ByteArray(32) { 0x20 }

        // Compute A -> B
        val resultA = SafetyNumberGenerator.computeSafetyNumber(pubKeyA, pubKeyB)

        // Compute B -> A
        val resultB = SafetyNumberGenerator.computeSafetyNumber(pubKeyB, pubKeyA)

        // Must be completely symmetrical regardless of evaluation order
        assertEquals(resultA.emojiCluster, resultB.emojiCluster)
        assertEquals(resultA.wordList, resultB.wordList)
        assertEquals(resultA.hexDisplay, resultB.hexDisplay)
        assertEquals(12, resultA.wordList.size)
    }
}
