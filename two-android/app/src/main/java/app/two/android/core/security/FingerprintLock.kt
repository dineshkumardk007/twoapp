package app.two.android.core.security

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Opening Two with a fingerprint instead of typing the PIN.
 *
 * The page's vault is encrypted under a key derived from the PIN, and the PIN
 * is stored nowhere. This keeps one copy of it, encrypted under a key that
 * lives in the phone's keystore and that the keystore will only use after a
 * fingerprint the phone itself has just checked. Without that touch the copy
 * is unreadable - to Two as much as to anyone - and it never leaves the phone.
 *
 * Deliberately strict:
 * - Only "strong" biometrics: a fingerprint, or a face only where Android
 *   rates the phone's face unlock as secure. The phone's own screen-lock PIN or
 *   pattern is not accepted, so knowing how to unlock the phone does not open
 *   Two; the Two PIN is the only other way in.
 * - Adding a fingerprint to the phone destroys the key (the keystore does
 *   this itself), so a finger added later cannot open Two. That is reported
 *   as "changed" until fingerprint unlock is turned on again or off.
 */
class FingerprintLock(private val context: Context) {

    sealed interface Result {
        /**
         * [pin] is set only for an unlock. Not a data class: its generated
         * toString would print the PIN into any log it reached.
         */
        class Ok(val pin: String? = null) : Result
        /** cancel, lockout, changed, unavailable, off, error */
        data class Failed(val reason: String) : Result
    }

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** unavailable, not-enrolled, off, on, or changed. */
    fun status(): String {
        when (BiometricManager.from(context).canAuthenticate(STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> Unit
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                // Every fingerprint removed: whatever was kept is unusable.
                if (hasCopy()) markChanged()
                return if (prefs.getBoolean(CHANGED, false)) "changed" else "not-enrolled"
            }
            else -> return "unavailable"
        }
        if (!hasCopy()) return if (prefs.getBoolean(CHANGED, false)) "changed" else "off"
        // A key the keystore has invalidated still exists; only trying it tells.
        return try {
            decryptCipher()
            "on"
        } catch (_: KeyPermanentlyInvalidatedException) {
            markChanged()
            "changed"
        } catch (_: Exception) {
            "on"
        }
    }

    /** Asks for a fingerprint, then keeps [pin] behind it. */
    fun enable(activity: FragmentActivity, pin: String, done: (Result) -> Unit) {
        if (!PIN_SHAPE.matches(pin)) return done(Result.Failed("error"))
        if (BiometricManager.from(context).canAuthenticate(STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
            return done(Result.Failed("unavailable"))
        }
        val cipher = try {
            deleteKey()
            Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, createKey()) }
        } catch (_: Exception) {
            return done(Result.Failed("error"))
        }
        prompt(
            activity,
            cipher,
            title = "Turn on fingerprint unlock",
            subtitle = "Touch the sensor to confirm it's you",
            negative = "Cancel"
        ) { result ->
            if (result is Result.Failed) return@prompt done(result)
            try {
                val bytes = pin.toByteArray(Charsets.UTF_8)
                val sealed = (result as Unlocked).cipher.doFinal(bytes)
                bytes.fill(0)
                prefs.edit()
                    .putString(IV, Base64.encodeToString(result.cipher.iv, Base64.NO_WRAP))
                    .putString(SEALED, Base64.encodeToString(sealed, Base64.NO_WRAP))
                    .remove(CHANGED)
                    .apply()
                done(Result.Ok())
            } catch (_: Exception) {
                deleteKey()
                done(Result.Failed("error"))
            }
        }
    }

    /** Asks for a fingerprint and hands back the PIN it guards. */
    fun unlock(activity: FragmentActivity, done: (Result) -> Unit) {
        if (!hasCopy()) return done(Result.Failed(if (prefs.getBoolean(CHANGED, false)) "changed" else "off"))
        val cipher = try {
            decryptCipher()
        } catch (_: KeyPermanentlyInvalidatedException) {
            markChanged()
            return done(Result.Failed("changed"))
        } catch (_: Exception) {
            return done(Result.Failed("error"))
        }
        prompt(
            activity,
            cipher,
            title = "Open Two",
            subtitle = null,
            negative = "Use PIN"
        ) { result ->
            if (result is Result.Failed) return@prompt done(result)
            try {
                val sealed = Base64.decode(prefs.getString(SEALED, null), Base64.NO_WRAP)
                val bytes = (result as Unlocked).cipher.doFinal(sealed)
                val pin = String(bytes, Charsets.UTF_8)
                bytes.fill(0)
                done(Result.Ok(pin))
            } catch (_: Exception) {
                done(Result.Failed("error"))
            }
        }
    }

    /** Forgets the kept PIN and its key. */
    fun disable() {
        deleteKey()
        prefs.edit().clear().apply()
    }

    /** A touch the keystore accepted, with the cipher it unlocked. */
    private class Unlocked(val cipher: Cipher) : Result

    private fun prompt(
        activity: FragmentActivity,
        cipher: Cipher,
        title: String,
        subtitle: String?,
        negative: String,
        done: (Result) -> Unit
    ) {
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val unlocked = result.cryptoObject?.cipher
                done(if (unlocked != null) Unlocked(unlocked) else Result.Failed("error"))
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                done(Result.Failed(reasonFor(errorCode)))
            }
            // A finger that does not match keeps the prompt up; nothing to report.
        }
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .apply { if (subtitle != null) setSubtitle(subtitle) }
            .setNegativeButtonText(negative)
            .setAllowedAuthenticators(STRONG)
            // A face that is recognised opens straight away, no extra tap.
            .setConfirmationRequired(false)
            .build()
        try {
            BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), callback)
                .authenticate(info, BiometricPrompt.CryptoObject(cipher))
        } catch (_: Exception) {
            done(Result.Failed("error"))
        }
    }

    private fun reasonFor(errorCode: Int): String = when (errorCode) {
        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
        BiometricPrompt.ERROR_USER_CANCELED,
        BiometricPrompt.ERROR_CANCELED -> "cancel"
        BiometricPrompt.ERROR_LOCKOUT,
        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "lockout"
        BiometricPrompt.ERROR_NO_BIOMETRICS,
        BiometricPrompt.ERROR_HW_NOT_PRESENT,
        BiometricPrompt.ERROR_HW_UNAVAILABLE -> "unavailable"
        else -> "error"
    }

    private fun hasCopy(): Boolean =
        prefs.getString(SEALED, null) != null && prefs.getString(IV, null) != null && keyStore().containsAlias(ALIAS)

    private fun markChanged() {
        deleteKey()
        prefs.edit().remove(SEALED).remove(IV).putBoolean(CHANGED, true).apply()
    }

    private fun decryptCipher(): Cipher {
        val key = keyStore().getKey(ALIAS, null) as SecretKey
        val iv = Base64.decode(prefs.getString(IV, null), Base64.NO_WRAP)
        return Cipher.getInstance(TRANSFORMATION).apply {
            init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_BITS, iv))
        }
    }

    @Suppress("DEPRECATION")
    private fun createKey(): SecretKey {
        val spec = KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)
            .apply {
                // Every use needs a fresh strong biometric. Below Android 11
                // that is already what no validity duration means, and only a
                // biometric can stand behind a CryptoObject there.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
                }
            }
            .build()
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(spec)
            generateKey()
        }
    }

    private fun deleteKey() {
        try {
            keyStore().deleteEntry(ALIAS)
        } catch (_: Exception) {
            // Nothing there to delete.
        }
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "app.two.android.fingerprint_pin"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_TAG_BITS = 128
        const val STRONG = BiometricManager.Authenticators.BIOMETRIC_STRONG
        const val PREFS = "two_fingerprint"
        const val IV = "iv"
        const val SEALED = "sealed"
        const val CHANGED = "changed"
        /** The PINs Two sets: digits only. */
        val PIN_SHAPE = Regex("^[0-9]{4,12}$")
    }
}
