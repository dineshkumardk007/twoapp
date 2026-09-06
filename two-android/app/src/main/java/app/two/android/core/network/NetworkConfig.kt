package app.two.android.core.network

import android.content.Context
import android.content.SharedPreferences

/**
 * Network configuration for connecting the Android client to the Zero-Knowledge Relay Server.
 * Supports local development (emulator/Wi-Fi) and live cloud deployments (Render, Railway, Cloudflare).
 */
object NetworkConfig {
    const val DEFAULT_CLOUD_URL = "https://twoapp-tfj8.onrender.com"
    const val EMULATOR_HOST = "10.0.2.2"
    const val DEFAULT_PORT = 4000
    const val PHYSICAL_DEVICE_HOST = "192.168.29.197"
    private const val PREFS_NAME = "two_network_prefs"
    private const val KEY_CUSTOM_URL = "custom_relay_url"

    var isEmulator: Boolean = true

    @Volatile
    var customServerUrl: String = ""
        private set

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        customServerUrl = prefs.getString(KEY_CUSTOM_URL, "") ?: ""
    }

    fun setServerUrl(context: Context, url: String) {
        val trimmed = url.trim().removeSuffix("/")
        customServerUrl = trimmed
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_CUSTOM_URL, trimmed).apply()
    }

    val isConfiguredForCloud: Boolean
        get() = true

    val httpBaseUrl: String
        get() {
            val target = if (customServerUrl.isNotBlank()) customServerUrl else DEFAULT_CLOUD_URL
            val url = target.removeSuffix("/")
            return if (url.startsWith("http://") || url.startsWith("https://")) {
                url
            } else {
                "https://$url"
            }
        }

    val wsRelayUrl: String
        get() {
            val target = if (customServerUrl.isNotBlank()) customServerUrl else DEFAULT_CLOUD_URL
            val clean = target.removeSuffix("/")
            val withoutProtocol = clean
                .removePrefix("https://")
                .removePrefix("http://")
                .removePrefix("wss://")
                .removePrefix("ws://")

            val scheme = if (clean.startsWith("http://") || clean.startsWith("ws://")) "ws" else "wss"
            return "$scheme://$withoutProtocol/relay"
        }
}
