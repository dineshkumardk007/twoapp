package app.two.android.core.update

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Updates without the Play Store.
 *
 * Every signed build CI makes is published as a GitHub release with two files:
 * the APK and update.json, which names its version, its SHA-256 and what is
 * new. This reads the newest update.json, and when it is newer than what is
 * installed, downloads the APK, checks it, and hands it to Android's own
 * installer - which always asks before it installs anything. No app outside a
 * store may update itself silently, and this one does not try.
 *
 * Checked before the installer sees it:
 * - the SHA-256 update.json promised, so a broken download is not offered;
 * - the package name, the version, and the signing certificate, which must be
 *   the one this installed copy was signed with. Android refuses an update
 *   signed with any other key anyway; checking first means a bad file is
 *   turned away with a reason instead of an installer error.
 *
 * Only release builds update this way. A debug build is a different app with
 * a different key, and the releases could never install over it.
 */
class AppUpdater(private val context: Context) {

    class Update(
        val code: Long,
        val name: String,
        val apkUrl: String,
        val sha256: String,
        val size: Long,
        val notes: List<String>
    )

    class Failure(val reason: String) : Exception(reason)

    val installedCode: Long
        get() = packageInfo(0)?.let { versionCodeOf(it) } ?: 0L

    val installedName: String
        get() = packageInfo(0)?.versionName ?: ""

    val updatable: Boolean
        get() = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0

    /** Background thread only. The newer release, or null when there is none. */
    fun check(): Update? {
        if (!updatable) return null
        val raw = String(fetch(MANIFEST_URL, MANIFEST_LIMIT, 0L, null), Charsets.UTF_8)
        val json = JSONObject(raw)
        val code = json.getLong("versionCode")
        if (code <= installedCode) return null
        val apkUrl = json.getString("apk")
        // Only ever this repository's own releases.
        if (!apkUrl.startsWith(RELEASE_DOWNLOADS)) throw Failure("verify")
        val sha256 = json.getString("sha256").lowercase()
        if (!SHA256_SHAPE.matches(sha256)) throw Failure("verify")
        val notesJson = json.optJSONArray("notes")
        val notes = (0 until (notesJson?.length() ?: 0))
            .mapNotNull { notesJson?.optString(it)?.trim()?.takeIf { line -> line.isNotEmpty() }?.take(140) }
            .take(MAX_NOTES)
        return Update(
            code = code,
            name = json.optString("versionName").take(32).ifEmpty { code.toString() },
            apkUrl = apkUrl,
            sha256 = sha256,
            size = json.optLong("size", 0L),
            notes = notes
        )
    }

    /**
     * Background thread only. Downloads [update] into the cache and checks it;
     * [progress] hears 0..1 as it arrives. Throws [Failure] with "network" or
     * "verify".
     */
    fun download(update: Update, progress: (Double) -> Unit): File {
        val dir = File(context.cacheDir, UPDATE_DIR)
        dir.deleteRecursively()
        dir.mkdirs()
        val file = File(dir, "two-${update.code}.apk")
        val digest = MessageDigest.getInstance("SHA-256")
        file.outputStream().use { out ->
            fetch(update.apkUrl, APK_LIMIT, update.size) { chunk: ByteArray, count: Int, done: Long ->
                out.write(chunk, 0, count)
                digest.update(chunk, 0, count)
                if (update.size > 0) progress((done.toDouble() / update.size).coerceIn(0.0, 1.0))
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        if (actual != update.sha256) {
            file.delete()
            throw Failure("verify")
        }
        verifyArchive(file, update)
        return file
    }

    fun canInstall(): Boolean = context.packageManager.canRequestPackageInstalls()

    /** The phone's "install unknown apps" switch for Two. */
    fun openInstallPermission(activity: Activity) {
        activity.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        )
    }

    /** Opens Android's installer on [file]; it asks before installing. */
    fun install(activity: Activity, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", file)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    private fun verifyArchive(file: File, update: Update) {
        val archive = archiveInfo(file)
        if (archive == null) {
            file.delete()
            throw Failure("verify")
        }
        if (archive.packageName != context.packageName || versionCodeOf(archive) != update.code) {
            file.delete()
            throw Failure("verify")
        }
        val theirs = signerDigests(archive)
        val ours = signerDigests(packageInfo(signatureFlag()))
        // Unreadable on some phones; Android's own check at install still holds.
        if (!theirs.isNullOrEmpty() && !ours.isNullOrEmpty() && theirs.intersect(ours).isEmpty()) {
            file.delete()
            throw Failure("verify")
        }
    }

    /**
     * GET [url] over https, following GitHub's redirect to its file storage,
     * refusing anything bigger than [limit]. With [onChunk] the body streams
     * through it and nothing is returned.
     */
    private fun fetch(
        url: String,
        limit: Long,
        expected: Long,
        onChunk: ((ByteArray, Int, Long) -> Unit)?
    ): ByteArray {
        var target = URL(url)
        repeat(MAX_REDIRECTS) {
            if (target.protocol != "https") throw Failure("network")
            val connection = (target.openConnection() as HttpURLConnection).apply {
                instanceFollowRedirects = false
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("Accept", "application/octet-stream, application/json")
                setRequestProperty("User-Agent", "Two-Android")
            }
            try {
                val status = connection.responseCode
                if (status in 300..399) {
                    val next = connection.getHeaderField("Location") ?: throw Failure("network")
                    target = URL(target, next)
                    return@repeat
                }
                if (status != 200) throw Failure("network")
                val length = connection.contentLengthLong
                if (length > limit || (expected > 0 && length > 0 && length != expected)) throw Failure("verify")
                val buffer = ByteArray(64 * 1024)
                val collected = if (onChunk == null) java.io.ByteArrayOutputStream() else null
                var total = 0L
                connection.inputStream.use { input ->
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > limit) throw Failure("verify")
                        if (onChunk != null) onChunk(buffer, read, total) else collected!!.write(buffer, 0, read)
                    }
                }
                return collected?.toByteArray() ?: ByteArray(0)
            } catch (failure: Failure) {
                throw failure
            } catch (_: Exception) {
                throw Failure("network")
            } finally {
                connection.disconnect()
            }
        }
        throw Failure("network")
    }

    @Suppress("DEPRECATION")
    private fun signatureFlag(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES
        else PackageManager.GET_SIGNATURES

    @Suppress("DEPRECATION")
    private fun packageInfo(flags: Int): PackageInfo? = try {
        context.packageManager.getPackageInfo(context.packageName, flags)
    } catch (_: Exception) {
        null
    }

    @Suppress("DEPRECATION")
    private fun archiveInfo(file: File): PackageInfo? = try {
        context.packageManager.getPackageArchiveInfo(file.path, signatureFlag())
    } catch (_: Exception) {
        null
    }

    @Suppress("DEPRECATION")
    private fun signerDigests(info: PackageInfo?): Set<String>? {
        if (info == null) return null
        val signatures: Array<Signature>? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signing = info.signingInfo ?: return null
            if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        } else {
            info.signatures
        }
        if (signatures == null) return null
        val sha = MessageDigest.getInstance("SHA-256")
        return signatures.map { signature ->
            sha.digest(signature.toByteArray()).joinToString("") { "%02x".format(it) }
        }.toSet()
    }

    @Suppress("DEPRECATION")
    private fun versionCodeOf(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

    private companion object {
        const val REPO = "dineshkumardk007/twoapp"
        const val MANIFEST_URL = "https://github.com/$REPO/releases/latest/download/update.json"
        const val RELEASE_DOWNLOADS = "https://github.com/$REPO/releases/download/"
        const val UPDATE_DIR = "updates"
        const val MANIFEST_LIMIT = 64L * 1024
        const val APK_LIMIT = 200L * 1024 * 1024
        const val MAX_REDIRECTS = 5
        const val MAX_NOTES = 8
        val SHA256_SHAPE = Regex("^[0-9a-f]{64}$")
    }
}
