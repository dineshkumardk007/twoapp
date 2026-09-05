package app.two.android.core.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Manages hardware-backed encryption keys using Android Keystore (StrongBox / TEE).
 * Wraps local storage keys and database secrets so raw keys never persist unencrypted on disk.
 */
class KeystoreManager {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val MASTER_WRAP_KEY_ALIAS = "app.two.android.master_wrap_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
    }

    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    init {
        ensureMasterKeyExists()
    }

    private fun ensureMasterKeyExists() {
        if (!keyStore.containsAlias(MASTER_WRAP_KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            )
            val parameterSpec = KeyGenParameterSpec.Builder(
                MASTER_WRAP_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()

            keyGenerator.init(parameterSpec)
            keyGenerator.generateKey()
        }
    }

    /**
     * Wraps (encrypts) raw sensitive key material using the Keystore hardware key.
     */
    fun wrapKey(rawKey: ByteArray): ByteArray {
        val secretKey = keyStore.getKey(MASTER_WRAP_KEY_ALIAS, null) as SecretKey
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)

        val iv = cipher.iv
        val encrypted = cipher.doFinal(rawKey)

        // Return combined iv + ciphertext
        val combined = ByteArray(iv.size + encrypted.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(encrypted, 0, combined, iv.size, encrypted.size)
        return combined
    }

    /**
     * Unwraps (decrypts) sensitive key material.
     */
    fun unwrapKey(wrappedKey: ByteArray): ByteArray {
        val secretKey = keyStore.getKey(MASTER_WRAP_KEY_ALIAS, null) as SecretKey
        val cipher = Cipher.getInstance(TRANSFORMATION)

        val iv = ByteArray(GCM_IV_LENGTH)
        val ciphertext = ByteArray(wrappedKey.size - GCM_IV_LENGTH)
        System.arraycopy(wrappedKey, 0, iv, 0, GCM_IV_LENGTH)
        System.arraycopy(wrappedKey, GCM_IV_LENGTH, ciphertext, 0, ciphertext.size)

        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        return cipher.doFinal(ciphertext)
    }

    /**
     * Deletes all Keystore keys during an emergency exit or complete reset.
     */
    fun destroyKeystoreKeys() {
        if (keyStore.containsAlias(MASTER_WRAP_KEY_ALIAS)) {
            keyStore.deleteEntry(MASTER_WRAP_KEY_ALIAS)
        }
    }
}
