package app.two.android.features.web

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.ViewGroup
import android.webkit.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
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
        modifier = modifier.fillMaxSize(),
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
