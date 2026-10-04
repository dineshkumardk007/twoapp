package app.two.android.features.radio

import android.net.Uri

/**
 * Which addresses the radio will fetch: secure ones on the public internet.
 *
 * The same rule the page applies (liveStations.ts isPlayableStreamUrl),
 * applied again here because a station can come from the partner's phone:
 * never this device, the home network, or anything that is not https.
 */
object RadioUrls {

    private val dottedQuad = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")

    fun isSafe(uri: Uri): Boolean {
        if (uri.scheme?.lowercase() != "https") return false
        if (uri.userInfo != null) return false
        // 'localhost.' is localhost too.
        val host = uri.host?.lowercase()?.trimEnd('.') ?: return false
        if (host.isEmpty()) return false
        if (host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false
        // IPv6 literals: no station needs one, and they hide local addresses.
        if (host.contains(':') || host.startsWith("[")) return false
        if (dottedQuad.matches(host)) {
            val p = host.split('.').map { it.toInt() }
            if (p.any { it > 255 }) return false
            val private = p[0] == 0 || p[0] == 10 || p[0] == 127 ||
                (p[0] == 169 && p[1] == 254) ||
                (p[0] == 192 && p[1] == 168) ||
                (p[0] == 172 && p[1] in 16..31) ||
                (p[0] == 100 && p[1] in 64..127)
            return !private
        }
        // A name must end in a real top-level domain, which always has a
        // letter: this refuses numeric forms such as 2130706433 (127.0.0.1).
        return host.substringAfterLast('.').any { it in 'a'..'z' }
    }
}
