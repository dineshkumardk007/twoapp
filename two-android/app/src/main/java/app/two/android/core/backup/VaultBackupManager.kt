package app.two.android.core.backup

import android.util.Base64
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

data class EncryptedVaultEnvelope(
    val version: String = "1.0",
    val format: String = "TWO_ENCRYPTED_VAULT",
    val saltHex: String,
    val ivHex: String,
    val ciphertextBase64: String,
    val exportedAt: String,
    val recordCountInfo: String
)

object VaultBackupManager {

    private const val PBKDF2_ITERATIONS = 100000
    private const val KEY_LENGTH_BITS = 256
    private const val GCM_TAG_LENGTH = 128

    fun exportEncryptedVault(
        rawStateJson: String,
        passphrase: CharArray,
        recordSummary: String
    ): EncryptedVaultEnvelope {
        val random = SecureRandom()
        val salt = ByteArray(16).also { random.nextBytes(it) }
        val iv = ByteArray(12).also { random.nextBytes(it) }

        val keySpec = PBEKeySpec(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BITS)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val keyBytes = factory.generateSecret(keySpec).encoded
        val secretKey = SecretKeySpec(keyBytes, "AES")

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

        val ciphertext = cipher.doFinal(rawStateJson.toByteArray(Charsets.UTF_8))

        return EncryptedVaultEnvelope(
            saltHex = salt.joinToString("") { "%02x".format(it) },
            ivHex = iv.joinToString("") { "%02x".format(it) },
            ciphertextBase64 = Base64.encodeToString(ciphertext, Base64.NO_WRAP),
            exportedAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date()),
            recordCountInfo = recordSummary
        )
    }

    fun importEncryptedVault(
        envelope: EncryptedVaultEnvelope,
        passphrase: CharArray
    ): String {
        require(envelope.format == "TWO_ENCRYPTED_VAULT") { "Unrecognized vault format" }

        val salt = hexStringToByteArray(envelope.saltHex)
        val iv = hexStringToByteArray(envelope.ivHex)
        val ciphertext = Base64.decode(envelope.ciphertextBase64, Base64.NO_WRAP)

        val keySpec = PBEKeySpec(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BITS)
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val keyBytes = factory.generateSecret(keySpec).encoded
        val secretKey = SecretKeySpec(keyBytes, "AES")

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

        val decryptedBytes = cipher.doFinal(ciphertext)
        return String(decryptedBytes, Charsets.UTF_8)
    }

    private fun hexStringToByteArray(s: String): ByteArray {
        val len = s.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(s[i], 16) shl 4) + Character.digit(s[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}
