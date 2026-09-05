package app.two.android.core.network

/**
 * Network configuration for connecting the Android client to the Zero-Knowledge Relay Server.
 */
object NetworkConfig {
    // 10.0.2.2 is the special alias to your host loopback interface (localhost) from the Android Emulator.
    const val EMULATOR_HOST = "10.0.2.2"
    const val DEFAULT_PORT = 4000

    // Local Wi-Fi network host for physical Android testing
    const val PHYSICAL_DEVICE_HOST = "192.168.29.197"

    // Set to true when running on the standard Android Studio emulator
    var isEmulator: Boolean = true

    val host: String
        get() = if (isEmulator) EMULATOR_HOST else PHYSICAL_DEVICE_HOST

    val httpBaseUrl: String
        get() = "http://$host:$DEFAULT_PORT"

    val wsRelayUrl: String
        get() = "ws://$host:$DEFAULT_PORT/relay"
}
