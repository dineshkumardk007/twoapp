package app.two.android.features.web

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.*
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
 */
class AndroidWebBridge(private val context: Context) {
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

                addJavascriptInterface(AndroidWebBridge(context), "AndroidBridge")

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
