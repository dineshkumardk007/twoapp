package app.two.android.features.web

import androidx.compose.runtime.mutableStateOf

/**
 * The chat riding the keyboard, as a messenger's does.
 *
 * Everywhere else the page is made shorter for the keyboard once, as the
 * keyboard starts to move (imeAnimationTarget), which is cheap and keeps any
 * box in view. In a chat that same once-only resize is what made the message
 * box jump: it was already up at the keyboard's final height while the keys
 * were still sliding in, and dropped before they had gone.
 *
 * So while a chat is open the page asks for this ([overlay], set from
 * AndroidWebBridge.keyboardOverlay): the page keeps its full height, the
 * keyboard slides over it, and the page is told on every frame where the
 * keyboard is and where it is going (window.__twoIme(now, to), in CSS pixels
 * above the navigation bar). The page moves the message box and the messages
 * with it as a picture - nothing laid out again - and lays itself out once
 * the keyboard has stopped (core/keyboardRide).
 *
 * Off again whenever a page starts loading, so a page that never asks for it
 * - a lock, a reload - has the ordinary resize.
 */
object ImeRide {
    /** Main thread writes; Compose reads. */
    val overlay = mutableStateOf(false)
}
