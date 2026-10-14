package app.two.android.features.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.TextPaint
import android.text.TextUtils
import androidx.core.content.res.ResourcesCompat
import app.two.android.R
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Draws the home-screen widget: two circles, one for each of you, and the
 * bright lens where they overlap - Two's mark, come alive. Each side says how
 * that one of you is today (emotional weather and hearts), the days together
 * sit beneath, and new messages wait in the corner.
 *
 * One picture at the widget's real size rather than a layout of views: a
 * widget's views cannot use the app's fonts, fill words with a gradient or
 * blur a glow, and the words have to land inside the circles at any size.
 * The heart is the one real button, laid over the picture by widget_two.xml;
 * this leaves it room and lights the sky behind it.
 *
 * The pop-up (WidgetPopupActivity) draws its header with this too, so the two
 * always match.
 */
object WidgetArt {

    /** The heart button as widget_two.xml places it: its size, and its inset from the right edge. */
    private const val HEART_DP = 44f
    private const val HEART_INSET_DP = 12f

    class Fonts(val serif: Typeface, val bold: Typeface, val semibold: Typeface)

    fun fonts(context: Context): Fonts = Fonts(
        serif = font(context, R.font.fraunces_semibold, Typeface.create(Typeface.SERIF, Typeface.BOLD)),
        bold = font(context, R.font.manrope_bold, Typeface.DEFAULT_BOLD),
        semibold = font(context, R.font.manrope_semibold, Typeface.DEFAULT)
    )

    private fun font(context: Context, id: Int, fallback: Typeface): Typeface =
        try {
            ResourcesCompat.getFont(context, id) ?: fallback
        } catch (_: Exception) {
            fallback
        }

    /** Wide enough to sit the two of you side by side; anything squarer gets the small picture. */
    fun isWide(widthDp: Float, heightDp: Float): Boolean = widthDp >= heightDp * 1.4f

    /**
     * The picture, [widthDp] by [heightDp] at the screen's [density].
     *
     * [heart] leaves room for the heart button and lights the sky behind it.
     * [extras] adds the days-together line and the unread pill; the pop-up
     * says those in words of its own. [cornerDp] rounds the picture to the
     * launcher's widget shape - 0 for the pop-up, which rounds its own card.
     */
    fun draw(
        context: Context,
        summary: WidgetSummary,
        widthDp: Float,
        heightDp: Float,
        density: Float,
        cornerDp: Float,
        heart: Boolean,
        extras: Boolean = true
    ): Bitmap {
        val scale = density.coerceIn(1f, 3f)
        val w = (widthDp * scale).roundToInt().coerceIn(48, 1400)
        val h = (heightDp * scale).roundToInt().coerceIn(48, 1400)
        val content = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val scene = Scene(context, Canvas(content), summary, w.toFloat(), h.toFloat(), scale, fonts(context))
        scene.sky()
        if (isWide(widthDp, heightDp)) scene.wide(heart && !summary.isEmpty, extras) else scene.small(extras)
        if (cornerDp <= 0f) return content

        // Rounded by painting the picture through a rounded rectangle: the
        // edge is smoothed, and a glow near it is cut off cleanly.
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val radius = cornerDp * scale
        val bounds = RectF(0f, 0f, w.toFloat(), h.toFloat())
        val picture = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = BitmapShader(content, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        }
        canvas.drawRoundRect(bounds, radius, radius, picture)
        val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = scale
            color = Color.argb(26, 255, 255, 255)
        }
        canvas.drawRoundRect(RectF(bounds).apply { inset(scale / 2f, scale / 2f) }, radius, radius, edge)
        content.recycle()
        return out
    }

    private class Scene(
        val context: Context,
        val canvas: Canvas,
        val summary: WidgetSummary,
        val w: Float,
        val h: Float,
        val scale: Float,
        val fonts: Fonts
    ) {
        fun dp(value: Float): Float = value * scale

        /** The night sky: deepest at the edges, a little light at the middle, and a few stars. */
        fun sky() {
            val sky = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(
                    w / 2f, h / 2f, max(w, h) * 0.75f,
                    intArrayOf(NIGHT_MIDDLE, NIGHT, NIGHT_EDGE),
                    floatArrayOf(0f, 0.55f, 1f),
                    Shader.TileMode.CLAMP
                )
            }
            canvas.drawRect(0f, 0f, w, h, sky)
            val star = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
            for ((x, y, alpha) in STARS) {
                star.alpha = (alpha * 255).roundToInt()
                canvas.drawCircle(w * x, h * y, dp(1f), star)
            }
        }

        /** The two of you side by side, the days together beneath. */
        fun wide(heart: Boolean, extras: Boolean) {
            val heartZone = if (heart) dp(HEART_INSET_DP + HEART_DP + 4f) else 0f
            val bottom = if (extras) dp(40f) else dp(20f)
            val r = max(dp(24f), min((h - bottom) / 2f, (w - heartZone - dp(16f)) / 3.41f))
            val gap = 1.41f * r
            val half = gap / 2f + r
            // Centred on the widget when the heart leaves room, nudged left when it does not.
            val cx = min(w / 2f, w - heartZone - half - dp(4f))
            val cy = if (extras) dp(10f) + r else h / 2f
            if (heart) heartGlow()
            circles(cx, cy, r, gap)
            val k = (r / dp(68f)).coerceIn(0.75f, 1.25f)
            if (!summary.isEmpty) {
                side(cx - r, cy, r, k, "You", false, summary.myWeather, summary.myCapacity)
                side(cx + r, cy, r, k, summary.partner, summary.onlineNow, summary.theirWeather, summary.theirCapacity)
            }
            if (extras) {
                caption(cx, h - dp(12f), k)
                unreadPill(withIcon = true)
            }
        }

        /** The small square: the circles, and the days together under them. */
        fun small(extras: Boolean) {
            val r = max(dp(18f), min(w * 0.28f, (h - dp(64f)) / 2f))
            val k = (r / dp(48f)).coerceIn(0.8f, 1.3f)
            val gap = 0.96f * r
            val cx = w / 2f
            val block = 2f * r + dp(44f) * k
            val cy = max(dp(12f), (h - block) / 2f) + r
            circles(cx, cy, r, gap)
            if (summary.onlineNow) onlineDot(cx + gap / 2f + 0.70f * r, cy - 0.70f * r, dp(4f))
            val baseline = min(h - dp(26f), cy + r + dp(28f) * k)
            val days = summary.daysText()
            if (summary.isEmpty || days == null) {
                centred(if (summary.isEmpty) "Open Two" else summary.partner, text(fonts.semibold, 12f * k, INK_2), cx, baseline)
            } else {
                aurora(days, text(fonts.serif, 24f * k, Color.WHITE), cx, baseline)
                centred("days together", text(fonts.semibold, 11f * k, INK_2), cx, baseline + dp(16f) * k)
            }
            if (extras) unreadPill(withIcon = false)
        }

        /** Two circles [gap] apart around ([cx], [cy]), and the glowing lens they share. */
        private fun circles(cx: Float, cy: Float, r: Float, gap: Float) {
            val x1 = cx - gap / 2f
            val x2 = cx + gap / 2f
            disc(x1, cy, r, -0.30f, VIOLET, 0.55f, VIOLET, 0.18f, 0.70f, LILAC)
            disc(x2, cy, r, 0.30f, PINK, 0.50f, PEACH, 0.20f, 0.75f, ROSE)
            val lens = Path()
            lens.op(
                Path().apply { addCircle(x1, cy, r, Path.Direction.CW) },
                Path().apply { addCircle(x2, cy, r, Path.Direction.CW) },
                Path.Op.INTERSECT
            )
            val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = withAlpha(BLUSH, 0.55f)
                maskFilter = BlurMaskFilter(dp(10f), BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawPath(lens, glow)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(0f, cy - r, 0f, cy + r, Color.WHITE, BLUSH, Shader.TileMode.CLAMP)
            }
            canvas.drawPath(lens, fill)
        }

        /** One circle: lit from above and to one side, with a fine ring of its colour. */
        private fun disc(
            x: Float, y: Float, r: Float, lean: Float,
            from: Int, fromAlpha: Float, to: Int, toAlpha: Float, stop: Float, ring: Int
        ) {
            val light = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(
                    x + lean * r, y - 0.40f * r, 1.91f * r,
                    intArrayOf(withAlpha(from, fromAlpha), withAlpha(to, toAlpha), withAlpha(to, toAlpha)),
                    floatArrayOf(0f, stop, 1f),
                    Shader.TileMode.CLAMP
                )
            }
            canvas.drawCircle(x, y, r, light)
            val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = dp(1.5f)
                color = withAlpha(ring, 0.55f)
            }
            canvas.drawCircle(x, y, r - dp(0.75f), edge)
        }

        /** One of you: name, weather and hearts, centred on [x] inside that circle. */
        private fun side(
            x: Float, cy: Float, r: Float, k: Float,
            name: String, online: Boolean, weather: String, capacity: Int
        ) {
            val namePaint = text(fonts.bold, 12.5f * k, INK)
            val dot = if (online) dp(5f) + dp(8f) * k else 0f
            val shown = TextUtils.ellipsize(name, namePaint, 1.2f * r - dot, TextUtils.TruncateAt.END).toString()
            val nameWidth = namePaint.measureText(shown)
            val left = x - (nameWidth + dot) / 2f
            val nameBaseline = cy - 0.30f * r
            canvas.drawText(shown, left, nameBaseline, namePaint)
            if (online) onlineDot(left + nameWidth + dp(5f) + dp(4f) * k, nameBaseline - dp(4.5f) * k, dp(4f) * k)

            val stateBaseline = cy + 0.03f * r
            val word = WidgetSummary.weatherWord(weather)
            if (word != null) {
                val statePaint = text(fonts.semibold, 11f * k, INK_2)
                val icon = dp(15f) * k
                val gap = dp(4f)
                val start = x - (icon + gap + statePaint.measureText(word)) / 2f
                val iconTop = stateBaseline - statePaint.textSize * 0.36f - icon / 2f
                weatherIcon(weather, start, iconTop, icon)
                canvas.drawText(word, start + icon + gap, stateBaseline, statePaint)
            } else {
                centred("No weather yet", text(fonts.semibold, 10.5f * k, INK_3), x, stateBaseline)
            }
            if (capacity in 0..5) hearts(x, cy + 0.30f * r, capacity, k)
        }

        private fun weatherIcon(code: String, left: Float, top: Float, size: Float) {
            val id = when (code.uppercase()) {
                "SUNNY" -> R.drawable.ic_weather_sunny
                "CALM" -> R.drawable.ic_weather_clear
                "OVERCAST" -> R.drawable.ic_weather_overcast
                "RAINY" -> R.drawable.ic_weather_turbulent
                "STORMY" -> R.drawable.ic_weather_stormy
                else -> return
            }
            val icon = ResourcesCompat.getDrawable(context.resources, id, null) ?: return
            icon.setBounds(left.roundToInt(), top.roundToInt(), (left + size).roundToInt(), (top + size).roundToInt())
            icon.draw(canvas)
        }

        /** Five small hearts, [filled] of them lit: the capacity Home shows. */
        private fun hearts(x: Float, baseline: Float, filled: Int, k: Float) {
            val size = dp(9f) * k
            val gap = dp(2f) * k
            var left = x - (5f * size + 4f * gap) / 2f
            val top = baseline - size
            for (i in 0 until 5) {
                val heart = ResourcesCompat.getDrawable(context.resources, R.drawable.ic_widget_heart, null)?.mutate() ?: return
                heart.setTint(if (i < filled) PINK else Color.argb(56, 255, 255, 255))
                heart.setBounds(left.roundToInt(), top.roundToInt(), (left + size).roundToInt(), (top + size).roundToInt())
                heart.draw(canvas)
                left += size + gap
            }
        }

        /** In Two right now: a small mint light. */
        private fun onlineDot(x: Float, y: Float, radius: Float) {
            val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = withAlpha(MINT, 0.8f)
                maskFilter = BlurMaskFilter(radius * 1.6f, BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawCircle(x, y, radius, glow)
            canvas.drawCircle(x, y, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = MINT })
        }

        /** "1,703 days together" - or what to do while there is no count. */
        private fun caption(cx: Float, baseline: Float, k: Float) {
            val days = summary.daysText()
            if (summary.isEmpty || days == null) {
                val line = if (summary.isEmpty) "Open Two to link" else "You and ${summary.partner}"
                centred(line, text(fonts.semibold, 11.5f * k, INK_2), cx, baseline)
                return
            }
            val number = text(fonts.serif, 15f * k, Color.WHITE)
            val label = text(fonts.semibold, 11.5f * k, INK_3)
            val numberWidth = number.measureText(days)
            val gap = dp(5f)
            val left = cx - (numberWidth + gap + label.measureText("days together")) / 2f
            number.shader = auroraShader(left, numberWidth)
            canvas.drawText(days, left, baseline, number)
            canvas.drawText("days together", left + numberWidth + gap, baseline, label)
        }

        /** New messages from them: a count in a pink pill, top right. */
        private fun unreadPill(withIcon: Boolean) {
            if (summary.isEmpty || summary.unread <= 0) return
            val count = if (summary.unread > 99) "99+" else summary.unread.toString()
            val paint = text(fonts.bold, 11.5f, PINK_TEXT)
            val height = dp(22f)
            val icon = if (withIcon) dp(12f) else 0f
            val iconGap = if (withIcon) dp(4f) else 0f
            val inner = icon + iconGap + paint.measureText(count)
            val width = max(height, inner + dp(16f))
            val right = w - dp(12f)
            val top = dp(12f)
            val pill = RectF(right - width, top, right, top + height)
            val round = height / 2f
            canvas.drawRoundRect(pill, round, round, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(PINK, 0.22f) })
            val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = dp(1f)
                color = withAlpha(PINK, 0.35f)
            }
            canvas.drawRoundRect(RectF(pill).apply { inset(dp(0.5f), dp(0.5f)) }, round, round, ring)
            var x = pill.left + (width - inner) / 2f
            if (withIcon) {
                ResourcesCompat.getDrawable(context.resources, R.drawable.ic_widget_chat, null)?.let { chat ->
                    val iconTop = pill.centerY() - icon / 2f
                    chat.setBounds(x.roundToInt(), iconTop.roundToInt(), (x + icon).roundToInt(), (iconTop + icon).roundToInt())
                    chat.draw(canvas)
                }
                x += icon + iconGap
            }
            canvas.drawText(count, x, pill.centerY() - (paint.descent() + paint.ascent()) / 2f, paint)
        }

        /** A soft pink light where the heart button sits. */
        private fun heartGlow() {
            val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = withAlpha(PINK, 0.55f)
                maskFilter = BlurMaskFilter(dp(16f), BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawCircle(w - dp(HEART_INSET_DP + HEART_DP / 2f), h / 2f + dp(4f), dp(20f), glow)
        }

        private fun aurora(value: String, paint: TextPaint, cx: Float, baseline: Float) {
            val width = paint.measureText(value)
            val left = cx - width / 2f
            paint.shader = auroraShader(left, width)
            canvas.drawText(value, left, baseline, paint)
        }

        private fun auroraShader(left: Float, width: Float): Shader =
            LinearGradient(left, 0f, left + width, 0f, intArrayOf(LAVENDER, BLOSSOM, APRICOT), null, Shader.TileMode.CLAMP)

        private fun centred(value: String, paint: TextPaint, cx: Float, baseline: Float) {
            val shown = TextUtils.ellipsize(value, paint, w - dp(24f), TextUtils.TruncateAt.END).toString()
            canvas.drawText(shown, cx - paint.measureText(shown) / 2f, baseline, paint)
        }

        private fun text(face: Typeface, sizeDp: Float, colour: Int): TextPaint =
            TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = face
                textSize = dp(sizeDp)
                color = colour
            }
    }

    private fun withAlpha(colour: Int, alpha: Float): Int =
        ((alpha * 255).roundToInt().coerceIn(0, 255) shl 24) or (colour and 0x00FFFFFF)

    // The app's night and aurora (index.css), and the words' inks.
    private const val NIGHT_MIDDLE = 0xFF241A52.toInt()
    private const val NIGHT = 0xFF120D29.toInt()
    private const val NIGHT_EDGE = 0xFF0B0919.toInt()
    private const val VIOLET = 0xFF8B5CF6.toInt()
    private const val PINK = 0xFFEC4899.toInt()
    private const val PEACH = 0xFFFB923C.toInt()
    private const val LILAC = 0xFFC4B5FD.toInt()
    private const val ROSE = 0xFFF9A8D4.toInt()
    private const val BLUSH = 0xFFFFE4F1.toInt()
    private const val MINT = 0xFF6EE7B7.toInt()
    private const val PINK_TEXT = 0xFFFBCFE8.toInt()
    private const val INK = 0xFFF4F1FF.toInt()
    private const val INK_2 = 0xFFC9C1EA.toInt()
    private const val INK_3 = 0xFF9C94C4.toInt()
    private const val LAVENDER = 0xFFEDE4FF.toInt()
    private const val BLOSSOM = 0xFFF9A8D4.toInt()
    private const val APRICOT = 0xFFFDBA74.toInt()

    /** Where the stars are, as fractions of the width and height, and how bright. */
    private val STARS = listOf(
        Triple(0.06f, 0.17f, 0.55f),
        Triple(0.11f, 0.68f, 0.35f),
        Triple(0.92f, 0.40f, 0.40f),
        Triple(0.87f, 0.80f, 0.30f),
        Triple(0.52f, 0.05f, 0.25f),
        Triple(0.33f, 0.93f, 0.25f)
    )
}
