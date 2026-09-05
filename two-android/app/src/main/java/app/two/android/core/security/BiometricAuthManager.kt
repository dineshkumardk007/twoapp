package app.two.android.core.security

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * Manages biometric app lock (Fingerprint / Face Unlock / Device PIN)
 * with customizable background timeout thresholds.
 */
class BiometricAuthManager(private val context: Context) {

    private var lastBackgroundTimestamp: Long = 0L
    var lockTimeoutMillis: Long = 60_000L // Default: 1 minute timeout

    fun canAuthenticate(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    fun onAppBackgrounded() {
        lastBackgroundTimestamp = System.currentTimeMillis()
    }

    fun isUnlockRequired(): Boolean {
        if (lastBackgroundTimestamp == 0L) return false
        val elapsed = System.currentTimeMillis() - lastBackgroundTimestamp
        return elapsed >= lockTimeoutMillis
    }

    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String = "Unlock Two",
        subtitle: String = "Confirm your identity to enter your space",
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                lastBackgroundTimestamp = 0L
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                onError(errString.toString())
            }
        })

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        prompt.authenticate(promptInfo)
    }
}
