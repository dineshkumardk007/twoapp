package app.two.android.core.crypto

import java.security.MessageDigest

/**
 * Generates Safety Numbers for in-person or out-of-band identity verification.
 * Prevents Man-in-the-Middle (MitM) key substitution by a compromised relay server.
 */
object SafetyNumberGenerator {

    private val EMOJI_SET = listOf(
        "🌸", "🌿", "🌙", "🌊", "✨", "☕", "🏔️", "🕊️",
        "🕯️", "🍁", "🦊", "🪐", "🌻", "⛵", "🎨", "🌲"
    )

    data class SafetyNumberResult(
        val wordList: List<String>,
        val emojiCluster: String,
        val hexDisplay: String
    )

    /**
     * Computes the safety number from two public keys.
     * Keys are sorted lexicographically to ensure both partners derive the exact same result.
     */
    fun computeSafetyNumber(publicKeyA: ByteArray, publicKeyB: ByteArray): SafetyNumberResult {
        val (first, second) = if (compareByteArrays(publicKeyA, publicKeyB) <= 0) {
            Pair(publicKeyA, publicKeyB)
        } else {
            Pair(publicKeyB, publicKeyA)
        }

        // SHA-256 digest of concatenated keys (simulating BLAKE2b)
        val md = MessageDigest.getInstance("SHA-256")
        md.update(first)
        md.update(second)
        val digest = md.digest()

        // 1. Pick 12 words from BIP-39 dictionary based on byte pairs
        val words = mutableListOf<String>()
        for (i in 0 until 12) {
            val byte1 = digest[i * 2].toInt() and 0xFF
            val byte2 = digest[i * 2 + 1].toInt() and 0xFF
            val index = ((byte1 shl 8) or byte2) % Bip39Mnemonic.WORD_LIST.size
            words.add(Bip39Mnemonic.WORD_LIST[index])
        }

        // 2. Pick 4 emojis based on the last 4 bytes
        val emojis = StringBuilder()
        for (i in 0 until 4) {
            val byteVal = digest[digest.size - 4 + i].toInt() and 0xFF
            emojis.append(EMOJI_SET[byteVal % EMOJI_SET.size])
            if (i < 3) emojis.append(" ")
        }

        // 3. Hex formatted string (e.g. "4A8F-912C-...")
        val hex = digest.take(16).joinToString("") { "%02X".format(it) }
            .chunked(4).joinToString("-")

        return SafetyNumberResult(
            wordList = words,
            emojiCluster = emojis.toString(),
            hexDisplay = hex
        )
    }

    private fun compareByteArrays(a: ByteArray, b: ByteArray): Int {
        val len = minOf(a.size, b.size)
        for (i in 0 until len) {
            val byteA = a[i].toInt() and 0xFF
            val byteB = b[i].toInt() and 0xFF
            if (byteA != byteB) return byteA.compareTo(byteB)
        }
        return a.size.compareTo(b.size)
    }
}
