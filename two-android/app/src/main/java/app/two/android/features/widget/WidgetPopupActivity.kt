package app.two.android.features.widget

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.two.android.R
import app.two.android.core.security.SecurityWindowManager

/**
 * What the widget opens: a card over the home screen with the two of you as
 * the widget draws you (WidgetArt), your days together, the next anniversary,
 * unread messages and whether your partner is in Two - and a way into Two
 * from each.
 *
 * Its own task (taskAffinity "" in the manifest), so it floats over the home
 * screen rather than bringing Two forward behind it; tapping outside closes
 * it. Screenshots are blocked here as they are in Two.
 */
class WidgetPopupActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SecurityWindowManager.applyWindowProtection(this, true)
        val summary = WidgetSummary.read(this)
        val art = try {
            WidgetArt.draw(
                this, summary, ART_WIDTH_DP, ART_HEIGHT_DP, resources.displayMetrics.density,
                cornerDp = 0f, heart = false, extras = false
            ).asImageBitmap()
        } catch (_: Throwable) {
            null
        }
        val lines = PopupLines(
            days = summary.daysText(),
            since = summary.sinceText(),
            anniversary = summary.anniversaryText(),
            chat = if (summary.isEmpty) null else summary.chatText(this),
            mood = summary.moodText(),
            presence = summary.presenceText(this),
            updated = summary.updatedText(this),
            spoken = summary.spokenText(),
            unread = summary.unread > 0,
            online = summary.onlineNow,
            linked = !summary.isEmpty
        )
        setContent {
            WidgetPopup(lines, art, onClose = { finish() }, onOpen = { action -> open(action) })
        }
    }

    private fun open(action: String?) {
        startActivity(LaunchAction.intent(this, action))
        finish()
    }
}

/** The picture across the top of the card, in dp - its shape, not its final size. */
private const val ART_WIDTH_DP = 340f
private const val ART_HEIGHT_DP = 150f

/** Everything the card says, worked out before it is drawn. */
private class PopupLines(
    val days: String?,
    val since: String?,
    val anniversary: String?,
    val chat: String?,
    val mood: String?,
    val presence: String?,
    val updated: String?,
    val spoken: String,
    val unread: Boolean,
    val online: Boolean,
    val linked: Boolean
)

// The app's own type (res/font): Fraunces for numbers and names, Manrope for the rest.
private val Serif = FontFamily(Font(R.font.fraunces_semibold, FontWeight.SemiBold))
private val Sans = FontFamily(
    Font(R.font.manrope_medium, FontWeight.Medium),
    Font(R.font.manrope_semibold, FontWeight.SemiBold),
    Font(R.font.manrope_bold, FontWeight.Bold)
)

private val Lavender = Color(0xFFF4F1FF)
private val Muted = Color(0xFFAAA2CD)
private val Gold = Color(0xFFFCD34D)
private val Pink = Color(0xFFF472B6)
private val Mint = Color(0xFF6EE7B7)
private val Aurora = Brush.linearGradient(listOf(Color(0xFF8B5CF6), Color(0xFFEC4899), Color(0xFFFB923C)))
private val AuroraWords = Brush.linearGradient(listOf(Color(0xFFEDE4FF), Color(0xFFF9A8D4), Color(0xFFFDBA74)))
private val Night = Brush.radialGradient(listOf(Color(0xFF241A52), Color(0xFF120D29), Color(0xFF0B0919)))

@Composable
private fun WidgetPopup(lines: PopupLines, art: ImageBitmap?, onClose: () -> Unit, onOpen: (String?) -> Unit) {
    val outside = remember { MutableInteractionSource() }
    val inside = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(28.dp)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x99000000))
            .clickable(interactionSource = outside, indication = null) { onClose() },
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(20.dp)
                .widthIn(max = 420.dp)
                .fillMaxWidth()
                .clip(shape)
                .background(Night)
                .border(1.dp, Color(0x1AFFFFFF), shape)
                // Taps on the card stay on the card.
                .clickable(interactionSource = inside, indication = null) { }
                .padding(bottom = 22.dp)
        ) {
            if (art != null) {
                Image(
                    bitmap = art,
                    contentDescription = lines.spoken,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(ART_WIDTH_DP / ART_HEIGHT_DP)
                )
            } else {
                Spacer(Modifier.height(22.dp))
            }

            Column(modifier = Modifier.padding(horizontal = 22.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Two", color = Pink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, fontFamily = Serif)
                    Spacer(Modifier.weight(1f))
                    lines.updated?.let {
                        Text(it, color = Muted, fontSize = 11.sp, fontWeight = FontWeight.Medium, fontFamily = Sans)
                    }
                }

                if (lines.days != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            lines.days,
                            style = TextStyle(
                                brush = AuroraWords,
                                fontSize = 44.sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = Serif
                            )
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "days together",
                            color = Lavender,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = Sans,
                            modifier = Modifier.padding(bottom = 9.dp)
                        )
                    }
                    lines.since?.let {
                        Text(it, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Medium, fontFamily = Sans)
                    }
                }
                lines.anniversary?.let {
                    Spacer(Modifier.height(10.dp))
                    Text(it, color = Gold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFamily = Sans)
                }

                if (lines.linked) {
                    Spacer(Modifier.height(18.dp))
                    Section(title = "Chat", body = lines.chat ?: "No new messages", accent = if (lines.unread) Pink else null)
                    // The picture already shows how they are; said in words only when it could not be drawn.
                    val partner = listOfNotNull(if (art == null) lines.mood else null, lines.presence)
                    if (partner.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Section(
                            title = "Your partner",
                            body = partner.joinToString("\n"),
                            accent = if (lines.online) Mint else null
                        )
                    }
                } else {
                    Spacer(Modifier.height(14.dp))
                    Text("Open Two to link with your partner.", color = Lavender, fontSize = 14.sp, fontFamily = Sans)
                }

                Spacer(Modifier.height(20.dp))
                if (lines.linked) {
                    PopupButton("Send a heartbeat", primary = true, modifier = Modifier.fillMaxWidth()) { onOpen("heartbeat") }
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PopupButton("Open chat", primary = false, modifier = Modifier.weight(1f)) { onOpen("chat") }
                        PopupButton("Open Two", primary = false, modifier = Modifier.weight(1f)) { onOpen(null) }
                    }
                } else {
                    PopupButton("Open Two", primary = true, modifier = Modifier.fillMaxWidth()) { onOpen(null) }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "Shows Two as it was when last opened. Never any message words.",
                    color = Muted,
                    fontSize = 10.sp,
                    fontFamily = Sans
                )
            }
        }
    }
}

@Composable
private fun Section(title: String, body: String, accent: Color?) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Color(0x14FFFFFF))
            .border(1.dp, accent?.copy(alpha = 0.4f) ?: Color(0x1AFFFFFF), shape)
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Text(
            title.uppercase(),
            color = accent ?: Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = Sans,
            letterSpacing = 1.sp
        )
        Spacer(Modifier.height(4.dp))
        Text(body, color = Lavender, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium, fontFamily = Sans)
    }
}

@Composable
private fun PopupButton(label: String, primary: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(if (primary) Aurora else SolidColor(Color(0x1FFFFFFF)))
            .clickable { onClick() }
            .padding(vertical = 13.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, fontFamily = Sans)
    }
}
