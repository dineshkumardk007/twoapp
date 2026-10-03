package app.two.android.features.web

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.DocumentsContract
import android.graphics.Color
import android.util.Base64
import android.view.ViewGroup
import android.webkit.*
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import app.two.android.core.network.NetworkConfig

/**
 * JavaScript interface exposed to the embedded Web application as window.AndroidBridge
 *
 * [onSaveFile] is handed a file the page wants saved, on the main thread.
 */
class AndroidWebBridge(
    private val context: Context,
    private val onSaveFile: (name: String, mimeType: String, bytes: ByteArray) -> Unit = { _, _, _ -> }
) {
    /**
     * Saves a file the page made - a backup, an export.
     *
     * A WebView ignores download links unless the app handles them, and this
     * one did not, so every export in the app did nothing on the phone. The
     * page now passes the bytes here instead, and the phone's own "save to"
     * screen lets the person choose where they go.
     *
     * Returns false only when the bytes could not be read, so the page can
     * say so rather than assume the file was saved.
     */
    @JavascriptInterface
    fun saveFile(filename: String, mimeType: String, base64: String): Boolean {
        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (_: IllegalArgumentException) {
            return false
        }
        // Bridge calls arrive on a background thread; the save screen opens
        // from the main one.
        ContextCompat.getMainExecutor(context).execute { onSaveFile(filename, mimeType, bytes) }
        return true
    }

    @JavascriptInterface
    fun getRelayUrl(): String {
        return NetworkConfig.wsRelayUrl
    }

    @JavascriptInterface
    fun setRelayUrl(url: String) {
        NetworkConfig.setServerUrl(context, url)
    }

    @JavascriptInterface
    fun isAndroid(): Boolean {
        return true
    }

    /**
     * Whether earphones of any kind are connected.
     *
     * The call turns echo cancellation off only with earphones, for the more
     * natural sound - and a WebView cannot see audio outputs reliably enough
     * to make that call itself. Guessing wrong in the "yes" direction would
     * send a speaker's output straight back into the microphone.
     */
    @JavascriptInterface
    fun isHeadsetConnected(): Boolean {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
        val earphones = setOf(
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
            AudioDeviceInfo.TYPE_USB_HEADSET
        )
        return audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type in earphones }
    }

    /**
     * Puts the phone into call mode, and picks earpiece or speaker.
     *
     * Without call mode a WebView plays the other voice as media - through the
     * loudspeaker, at media volume - rather than at your ear.
     */
    @JavascriptInterface
    fun setCallAudio(active: Boolean, speaker: Boolean) {
        setCallAudioRoute(active, speaker, false)
    }

    /**
     * Call audio routing that knows about earphones.
     *
     * Call mode sends the other voice through the phone's voice-call path,
     * which on many phones is processed and band-limited the way a cellular
     * call is - the sound this app is trying to get away from. That mode is
     * only needed for the earpiece, and for the phone's own echo cancellation
     * on speaker. With earphones there is neither, so the call stays on the
     * media path and plays at full fidelity.
     */
    @JavascriptInterface
    fun setCallAudioRoute(active: Boolean, speaker: Boolean, headset: Boolean) {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val voicePath = active && (speaker || !headset)
        audio.mode = if (voicePath) AudioManager.MODE_IN_COMMUNICATION else AudioManager.MODE_NORMAL
        routeToSpeaker(audio, voicePath && speaker)
    }

    /**
     * Loudspeaker on or off for call audio.
     *
     * From Android 12 the old speakerphone switch is deprecated, and on many
     * phones it is quietly ignored while in call mode - the Speaker button
     * would light up and the voice would stay at the earpiece. The replacement
     * picks the call's output device directly.
     */
    private fun routeToSpeaker(audio: AudioManager, on: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val loudspeaker = if (on) {
                audio.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                }
            } else {
                null
            }
            if (loudspeaker != null) {
                audio.setCommunicationDevice(loudspeaker)
            } else {
                audio.clearCommunicationDevice()
            }
        } else {
            @Suppress("DEPRECATION")
            audio.isSpeakerphoneOn = on
        }
    }

    /**
     * Keeps a call's microphone alive with the screen off or the app left.
     * See CallKeepAliveService for why this needs a notification.
     */
    @JavascriptInterface
    fun setCallKeepAlive(on: Boolean) {
        if (on) CallKeepAliveService.start(context) else CallKeepAliveService.stop(context)
    }

    private var proximityLock: PowerManager.WakeLock? = null

    /**
     * Darkens the screen while the phone is held to an ear.
     *
     * What the phone's own dialer does, and what a WebView cannot do for
     * itself: without it the screen stays lit against a cheek, which presses
     * End or Mute mid-sentence. The lock only darkens the screen when the
     * sensor is covered; away from the face the screen works as normal.
     */
    @JavascriptInterface
    fun setProximityLock(on: Boolean) {
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
        synchronized(this) {
            if (on) {
                if (proximityLock?.isHeld == true) return
                if (!power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
                proximityLock = power.newWakeLock(
                    PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK,
                    "two:call-proximity"
                ).apply {
                    setReferenceCounted(false)
                    // A ceiling, in case the page never says the call ended.
                    acquire(4 * 60 * 60 * 1000L)
                }
            } else {
                proximityLock?.let {
                    // Wait for the phone to leave the face, or the screen would
                    // light up against a cheek the moment the call ends.
                    if (it.isHeld) it.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY)
                }
                proximityLock = null
            }
        }
    }
}

/**
 * Fullscreen embedded WebView running the complete, offline-bundled Two ecosystem
 * (Nightstand Soundscape, Midnight Radio, Canvas of Us, Love Letters, Time Capsule, etc.)
 * with secure origin (https://appassets.androidplatform.net) for WebCrypto & Audio APIs.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TwoWebView(
    modifier: Modifier = Modifier
) {
    val hostContext = LocalContext.current
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var canGoBackState by remember { mutableStateOf(false) }

    /*
     * A page asking for the microphone or for where you are needs two yeses,
     * and the app was only ever giving one.
     *
     * onPermissionRequest below answers for the page, and it answered yes to
     * everything. But Android has wanted the app itself to hold the matching
     * runtime permission since API 23, and nothing here ever asked for one -
     * no requestPermissions, no checkSelfPermission, anywhere. So the WebView
     * said yes, the operating system said no, and a whisper memo failed on the
     * phone while working perfectly in a browser, where the browser holds the
     * microphone permission on the page's behalf.
     *
     * Geolocation was worse: it does not arrive through onPermissionRequest at
     * all, but through onGeolocationPermissionsShowPrompt, which was not
     * overridden - so the default ran, and getCurrentPosition never resolved.
     *
     * The request is made at the moment the feature is used rather than at
     * launch. Asking for a microphone the first time the app opens, before
     * anybody has tried to record anything, is the prompt people deny without
     * reading.
     */
    /*
     * Files the page asks to open: a photo for a memory, a backup to restore.
     *
     * A WebView shows no file picker of its own. Without onShowFileChooser
     * the page's file inputs did nothing at all on the phone - tapping "add a
     * photo" or "select backup file" simply had no effect.
     */
    val pendingFiles = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val pickFiles = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = pendingFiles.value
        pendingFiles.value = null
        // Null when cancelled - and it must still be answered, or the page
        // keeps waiting and its file input never opens again.
        callback?.onReceiveValue(pickedUris(result.resultCode, result.data))
    }

    /* Files the page asks to save, held until the person picks a place. */
    val pendingSave = remember { mutableStateOf<ByteArray?>(null) }
    val createDocument = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val bytes = pendingSave.value
        pendingSave.value = null
        val target = result.data?.data
        // Backing out of the save screen is a choice, not a failure.
        if (result.resultCode != Activity.RESULT_OK || target == null) {
            return@rememberLauncherForActivityResult
        }
        if (bytes == null) {
            // The save screen has already made an empty file by now. The bytes
            // are gone - Android stopped the app while the screen was open -
            // so take the empty file away and say so, rather than leave a
            // backup that is 0 bytes and fails the day it is needed.
            discardDocument(hostContext, target)
            return@rememberLauncherForActivityResult
        }
        writeDocument(hostContext, target, bytes)
    }

    val saveThroughPicker: (String, String, ByteArray) -> Unit = saver@{ name, mimeType, bytes ->
        // One save screen at a time: a second would take this one's bytes,
        // and whichever answered last would write into the wrong file.
        if (pendingSave.value != null) {
            Toast.makeText(hostContext, "Finish saving the first file", Toast.LENGTH_SHORT).show()
            return@saver
        }
        pendingSave.value = bytes
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = documentType(name, mimeType)
            putExtra(Intent.EXTRA_TITLE, name)
        }
        try {
            createDocument.launch(intent)
        } catch (_: ActivityNotFoundException) {
            pendingSave.value = null
            Toast.makeText(hostContext, "No app on this phone can save files", Toast.LENGTH_LONG).show()
        }
    }

    val pendingMedia = remember { mutableStateOf<PermissionRequest?>(null) }
    val pendingGeo = remember {
        mutableStateOf<Pair<String, GeolocationPermissions.Callback>?>(null)
    }

    val askAndroid = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        pendingMedia.value?.let { request ->
            pendingMedia.value = null
            try {
                if (granted[Manifest.permission.RECORD_AUDIO] == true) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    request.deny()
                }
            } catch (_: IllegalStateException) {
                // The page navigated away while the prompt was up.
            }
        }

        pendingGeo.value?.let { (origin, callback) ->
            pendingGeo.value = null
            val allowed = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            // Never remembered: a shared location is a decision worth making
            // each time rather than once, forever, by accident.
            callback.invoke(origin, allowed, false)
        }
    }

    fun holds(permission: String): Boolean =
        ContextCompat.checkSelfPermission(hostContext, permission) ==
            PackageManager.PERMISSION_GRANTED

    BackHandler(enabled = canGoBackState) {
        if (webViewRef?.canGoBack() == true) {
            webViewRef?.goBack()
        }
    }

    AndroidView(
        // Keeps the WebView inside the area it is actually allowed to draw in:
        // below the status bar, above the gesture bar, and above the keyboard.
        //
        // The window is edge-to-edge, which on its own means the page paints
        // under the notification shade and counts that space in 100dvh. It also
        // means the window never resizes for the keyboard, so adjustResize has
        // nothing to act on and the page pans instead of shrinking - which is
        // why the chat slid out of place when the keyboard opened.
        //
        // safeDrawing covers system bars, display cutouts and the IME together,
        // so the WebView shrinks as the keyboard rises and 100dvh inside it is
        // finally the height you can see.
        modifier = modifier
            .fillMaxSize()
            .safeDrawingPadding(),
        factory = { context ->
            val assetLoader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
                .build()

            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(Color.parseColor("#FAF8F5"))
                // Let the page paint under the system bars; the CSS handles insets.
                setFitsSystemWindows(false)
                overScrollMode = WebView.OVER_SCROLL_NEVER

                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    databaseEnabled = true
                    mediaPlaybackRequiresUserGesture = false
                    setGeolocationEnabled(true)
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    setSupportZoom(false)

                    // The bundle is a responsive layout, not a desktop page: let it
                    // lay out at the device's own width so a tablet gets a tablet
                    // layout rather than a scaled-up phone one.
                    textZoom = 100
                    layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL
                }

                addJavascriptInterface(AndroidWebBridge(context, saveThroughPicker), "AndroidBridge")

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): WebResourceResponse? {
                        val url = request?.url ?: return null
                        return assetLoader.shouldInterceptRequest(url)
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        canGoBackState = view?.canGoBack() == true
                    }
                }

                webChromeClient = object : WebChromeClient() {
                    /**
                     * The microphone, for whisper memos.
                     *
                     * It used to grant whatever was asked for, which was both
                     * too generous and not enough: too generous because a page
                     * asking for a camera would have been handed one, and the
                     * app no longer even holds that permission; not enough
                     * because granting here does nothing unless Android has
                     * granted the app first.
                     */
                    override fun onPermissionRequest(request: PermissionRequest?) {
                        if (request == null) return
                        val audio = PermissionRequest.RESOURCE_AUDIO_CAPTURE
                        if (!request.resources.contains(audio)) {
                            request.deny()
                            return
                        }
                        if (holds(Manifest.permission.RECORD_AUDIO)) {
                            request.grant(arrayOf(audio))
                        } else {
                            pendingMedia.value = request
                            askAndroid.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
                        }
                    }

                    /**
                     * Where you are, for the coordinates map.
                     *
                     * Geolocation never reaches onPermissionRequest; it comes
                     * here, and leaving this unoverridden meant the default ran
                     * and the page's getCurrentPosition simply never came back.
                     */
                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: GeolocationPermissions.Callback?
                    ) {
                        if (origin == null || callback == null) return
                        val fine = Manifest.permission.ACCESS_FINE_LOCATION
                        val coarse = Manifest.permission.ACCESS_COARSE_LOCATION
                        if (holds(fine) || holds(coarse)) {
                            callback.invoke(origin, true, false)
                        } else {
                            pendingGeo.value = origin to callback
                            askAndroid.launch(arrayOf(fine, coarse))
                        }
                    }

                    override fun onShowFileChooser(
                        webView: WebView?,
                        filePathCallback: ValueCallback<Array<Uri>>?,
                        fileChooserParams: FileChooserParams?
                    ): Boolean {
                        if (filePathCallback == null) return false
                        // A picker still open from a double tap is answered
                        // with nothing first, or the page waits on it forever.
                        pendingFiles.value?.onReceiveValue(null)
                        pendingFiles.value = filePathCallback
                        return try {
                            pickFiles.launch(filePickerIntent(fileChooserParams))
                            true
                        } catch (_: ActivityNotFoundException) {
                            pendingFiles.value = null
                            filePathCallback.onReceiveValue(null)
                            true
                        }
                    }
                }

                loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
                webViewRef = this
            }
        },
        update = {
            webViewRef = it
            canGoBackState = it.canGoBack()
        }
    )
}

/**
 * A picker for what the page's file input accepts.
 *
 * Not FileChooserParams.createIntent, which uses the first accept entry as the
 * MIME type whatever it is - and the backup input accepts ".two-vault,.json",
 * which are file extensions, not types. Handed one of those, the picker
 * filters for a type that does not exist and shows nothing.
 */
private fun filePickerIntent(params: WebChromeClient.FileChooserParams?): Intent {
    val mimeTypes = params?.acceptTypes.orEmpty()
        .map { it.trim().lowercase() }
        .filter { it.contains('/') }
        .distinct()
    return Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
        if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
        putExtra(
            Intent.EXTRA_ALLOW_MULTIPLE,
            params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        )
    }
}

/** What the picker returned, in the shape the page's callback takes; null if nothing. */
private fun pickedUris(resultCode: Int, data: Intent?): Array<Uri>? {
    if (resultCode != Activity.RESULT_OK || data == null) return null
    val clip = data.clipData
    if (clip != null && clip.itemCount > 0) {
        return Array(clip.itemCount) { clip.getItemAt(it).uri }
    }
    return data.data?.let { arrayOf(it) }
}

/**
 * The type to save a file as, chosen from its name.
 *
 * The save screen adds the extension it associates with the type when the
 * name does not already end in it, so a backup offered as JSON would be saved
 * as "two-vault-....two-vault.json". A name whose extension maps to a known
 * type keeps that type; anything else - the .two-vault backup - goes as plain
 * bytes, which the save screen leaves the name of alone.
 */
private fun documentType(name: String, fallback: String): String {
    val extension = name.substringAfterLast('.', "").lowercase()
    val known = if (extension.isEmpty()) null
    else MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
    return known ?: if (extension.isEmpty() && fallback.isNotBlank()) fallback else "application/octet-stream"
}

/** Writes a saved file off the main thread, then says how it went. */
private fun writeDocument(context: Context, target: Uri, bytes: ByteArray) {
    val appContext = context.applicationContext
    Thread {
        val saved = try {
            openTruncating(appContext, target)?.use { it.write(bytes) } != null
        } catch (_: Exception) {
            false
        }
        ContextCompat.getMainExecutor(appContext).execute {
            Toast.makeText(
                appContext,
                if (saved) "Saved" else "Could not save the file",
                Toast.LENGTH_SHORT
            ).show()
        }
    }.start()
}

/**
 * Opens a document for writing from its first byte, cutting off whatever was
 * there.
 *
 * Plain "w" does not truncate on Android 10 and later. The save screen lets
 * the person pick an existing file and overwrite it, and a new backup shorter
 * than the old one then kept the old one's tail - a file that no longer
 * parses, reported as saved. "wt" truncates; a provider that does not know it
 * is asked for "w" instead.
 */
private fun openTruncating(context: Context, target: Uri): java.io.OutputStream? =
    try {
        context.contentResolver.openOutputStream(target, "wt")
    } catch (_: IllegalArgumentException) {
        context.contentResolver.openOutputStream(target, "w")
    } catch (_: java.io.FileNotFoundException) {
        context.contentResolver.openOutputStream(target, "w")
    }

/** Removes a document the save screen created but nothing could be written into. */
private fun discardDocument(context: Context, target: Uri) {
    val appContext = context.applicationContext
    Thread {
        try {
            DocumentsContract.deleteDocument(appContext.contentResolver, target)
        } catch (_: Exception) {
            // Not every provider lets the app delete; the message still matters.
        }
        ContextCompat.getMainExecutor(appContext).execute {
            Toast.makeText(
                appContext,
                "Saving was interrupted - please export again",
                Toast.LENGTH_LONG
            ).show()
        }
    }.start()
}
