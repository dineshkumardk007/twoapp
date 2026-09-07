package app.two.android.features.web

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
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
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var canGoBackState by remember { mutableStateOf(false) }

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
                    override fun onPermissionRequest(request: PermissionRequest?) {
                        request?.grant(request.resources)
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
