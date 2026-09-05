package app.two.android

import app.two.android.core.crypto.CryptoEngine
import org.junit.Assert.*
import org.junit.Test

class CryptoEngineTest {

    @Test
    fun testPayloadEncryptionDecryptionRoundtrip() {
        val key = CryptoEngine.generateSpaceKey()
        val recordId = "test-record-uuid-1234"
        val spaceId = "test-space-uuid-5678"
        val recordType = "CHAT"
        val originalText = "This is an intimate encrypted thought."

        val encrypted = CryptoEngine.encryptPayload(
            plaintext = originalText.toByteArray(Charsets.UTF_8),
            key = key,
            recordId = recordId,
            spaceId = spaceId,
            recordType = recordType
        )

        assertNotNull(encrypted.ciphertext)
        assertNotNull(encrypted.nonce)
        assertFalse(originalText.toByteArray(Charsets.UTF_8).contentEquals(encrypted.ciphertext))

        val decryptedBytes = CryptoEngine.decryptPayload(
            ciphertext = encrypted.ciphertext,
            nonce = encrypted.nonce,
            key = key,
            recordId = recordId,
            spaceId = spaceId,
            recordType = recordType
        )

        assertEquals(originalText, String(decryptedBytes, Charsets.UTF_8))
    }

    @Test(expected = SecurityException::class)
    fun testTamperedAadFailsDecryption() {
        val key = CryptoEngine.generateSpaceKey()
        val recordId = "record-1"
        val spaceId = "space-1"
        val recordType = "JOURNAL"
        val plaintext = "Secret entry"

        val encrypted = CryptoEngine.encryptPayload(
            plaintext = plaintext.toByteArray(Charsets.UTF_8),
            key = key,
            recordId = recordId,
            spaceId = spaceId,
            recordType = recordType
        )

        // Attempting to decrypt with swapped recordId (swapping attack)
        CryptoEngine.decryptPayload(
            ciphertext = encrypted.ciphertext,
            nonce = encrypted.nonce,
            key = key,
            recordId = "swapped-record-id", // Tampered AAD
            spaceId = spaceId,
            recordType = recordType
        )
    }

    @Test
    fun testSubkeyDomainSeparation() {
        val spaceKey = CryptoEngine.generateSpaceKey()

        val chatSubkey = CryptoEngine.deriveSubkey(spaceKey, "chat____", 1L)
        val moodSubkey = CryptoEngine.deriveSubkey(spaceKey, "mood_log", 1L)

        assertFalse(chatSubkey.contentEquals(moodSubkey))
        assertEquals(32, chatSubkey.size)
        assertEquals(32, moodSubkey.size)
    }
}
