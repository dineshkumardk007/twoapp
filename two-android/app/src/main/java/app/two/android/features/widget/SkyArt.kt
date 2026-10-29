package app.two.android.features.widget

import android.graphics.Bitmap
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
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * The home-screen widget's picture: tonight's moon in its real phase over a
 * night sky, with the day and date beside it - nothing of the two of you, no
 * name, no count, nothing that says what app it belongs to. To anyone else
 * it is a moon widget.
 *
 * One thing only you know to look for: when a message has come and is not
 * read yet, a single star shines out near the moon ([news]).
 *
 * Drawn as one bitmap at the widget's real size, the way [WidgetArt] was,
 * because RemoteViews has no gradients, blurs or paths of its own.
 */
object SkyArt {

    /** A moon month, new moon to new moon, in days. */
    private const val SYNODIC_DAYS = 29.530588853

    /** A new moon to count from: 6 January 2000, 18:14 UTC, in epoch days. */
    private const val KNOWN_NEW_MOON_DAYS = 10_962.759_72

    /** How far through its month the moon is: 0 new, 0.5 full, back to 1. */
    fun phase(nowMs: Long = System.currentTimeMillis()): Double {
        val days = nowMs / 86_400_000.0 - KNOWN_NEW_MOON_DAYS
        val f = (days / SYNODIC_DAYS) % 1.0
        return if (f < 0) f + 1.0 else f
    }

    /** "Waxing crescent" and the rest - what a moon widget would call it. */
    fun phaseName(f: Double): String = when {
        f < 0.03 || f >= 0.97 -> "New moon"
        f < 0.22 -> "Waxing crescent"
        f < 0.28 -> "First quarter"
        f < 0.47 -> "Waxing gibbous"
        f < 0.53 -> "Full moon"
        f < 0.72 -> "Waning gibbous"
        f < 0.78 -> "Last quarter"
        else -> "Waning crescent"
    }

    /** Wide enough for the moon and the words side by side. */
    fun isWide(widthDp: Float, heightDp: Float): Boolean = widthDp >= heightDp * 1.45f

    fun draw(
        widthDp: Float,
        heightDp: Float,
        density: Float,
        cornerDp: Float,
        news: Boolean,
        nowMs: Long = System.currentTimeMillis()
    ): Bitmap {
        // Sharp enough, and small enough for the launcher to take: a widget's
        // bitmap goes through a binder call with a size limit.
        val scale = min(density, 2.5f)
        val w = max(1, (widthDp * scale).roundToInt())
        val h = max(1, (heightDp * scale).roundToInt())
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val u = scale // one dp, in pixels

        // The card: deep night, a little lighter towards the horizon.
        val card = RectF(0f, 0f, w.toFloat(), h.toFloat())
        val corner = cornerDp * u
        val clip = Path().apply { addRoundRect(card, corner, corner, Path.Direction.CW) }
        canvas.clipPath(clip)
        canvas.drawRect(card, Paint().apply {
            shader = LinearGradient(
                0f, 0f, 0f, h.toFloat(),
                intArrayOf(Color.rgb(6, 9, 24), Color.rgb(13, 18, 44), Color.rgb(28, 30, 66)),
                floatArrayOf(0f, 0.6f, 1f),
                Shader.TileMode.CLAMP
            )
        })
        // A faint violet haze low on one side, as a city sky has.
        canvas.drawRect(card, Paint().apply {
            shader = RadialGradient(
                w * 0.85f, h * 1.05f, max(w, h) * 0.75f,
                intArrayOf(Color.argb(70, 120, 90, 200), Color.argb(0, 120, 90, 200)),
                null, Shader.TileMode.CLAMP
            )
        })

        val wide = isWide(widthDp, heightDp)
        val r = if (wide) min(h * 0.30f, w * 0.17f) else min(w, h) * 0.24f
        val cx = if (wide) h * 0.52f + r * 0.2f else w / 2f
        val cy = if (wide) h / 2f else h * 0.40f

        // Stars, the same every night of a given day, so a redraw does not
        // move them; none too near the moon.
        val today = LocalDate.now(ZoneId.systemDefault())
        val random = Random(today.toEpochDay())
        val star = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        val count = (w * h / (u * u * 260f)).roundToInt().coerceIn(18, 90)
        repeat(count) {
            val x = random.nextFloat() * w
            val y = random.nextFloat() * h
            val dx = x - cx
            val dy = y - cy
            if (dx * dx + dy * dy < (r * 1.6f) * (r * 1.6f)) return@repeat
            star.alpha = (40 + random.nextInt(150))
            canvas.drawCircle(x, y, (0.35f + random.nextFloat() * 0.75f) * u, star)
        }

        // The moon's glow, then the moon.
        canvas.drawCircle(cx, cy, r * 2.2f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                cx, cy, r * 2.2f,
                intArrayOf(Color.argb(70, 235, 230, 210), Color.argb(18, 200, 200, 230), Color.argb(0, 0, 0, 0)),
                floatArrayOf(0.35f, 0.6f, 1f),
                Shader.TileMode.CLAMP
            )
        })
        val f = phase(nowMs)
        // The dark part, faintly lit by the earth.
        canvas.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(34, 38, 62) })
        val lit = litPath(cx, cy, r, f)
        val moonPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                cx - r * 0.3f, cy - r * 0.3f, r * 1.4f,
                intArrayOf(Color.rgb(252, 249, 238), Color.rgb(226, 220, 202), Color.rgb(196, 189, 170)),
                floatArrayOf(0f, 0.6f, 1f),
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawPath(lit, moonPaint)
        // A few seas, only where it is lit.
        canvas.save()
        canvas.clipPath(lit)
        val sea = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(34, 90, 86, 80) }
        canvas.drawCircle(cx - r * 0.28f, cy - r * 0.22f, r * 0.24f, sea)
        canvas.drawCircle(cx + r * 0.18f, cy - r * 0.32f, r * 0.15f, sea)
        canvas.drawCircle(cx + r * 0.05f, cy + r * 0.12f, r * 0.20f, sea)
        canvas.drawCircle(cx - r * 0.12f, cy + r * 0.45f, r * 0.10f, sea)
        canvas.drawCircle(cx + r * 0.42f, cy + r * 0.28f, r * 0.08f, sea)
        canvas.restore()

        // The star that only you know about.
        if (news) drawSign(canvas, cx + r * 1.55f, cy - r * 1.05f, u)

        // The words: the day, the date, the moon's name.
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        val light = Typeface.create("sans-serif-light", Typeface.NORMAL)
        val medium = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        val day = today.format(DateTimeFormatter.ofPattern("EEEE", Locale.getDefault())).uppercase(Locale.getDefault())
        val date = today.format(DateTimeFormatter.ofPattern("d MMMM", Locale.getDefault()))
        val name = phaseName(f)
        if (wide) {
            val left = cx + r * 2.0f
            val room = w - left - 16f * u
            val dateSize = fit(text, light, date, room, min(h * 0.24f, 34f * u))
            text.typeface = medium
            text.textSize = dateSize * 0.36f
            text.letterSpacing = 0.22f
            text.alpha = 165
            canvas.drawText(day, left, cy - dateSize * 0.62f, text)
            text.typeface = light
            text.textSize = dateSize
            text.letterSpacing = 0f
            text.alpha = 245
            canvas.drawText(date, left, cy + dateSize * 0.34f, text)
            text.typeface = medium
            text.textSize = dateSize * 0.38f
            text.letterSpacing = 0.04f
            text.alpha = 140
            canvas.drawText(name, left, cy + dateSize * 1.05f, text)
        } else {
            text.textAlign = Paint.Align.CENTER
            val dateSize = fit(text, light, date, w * 0.84f, min(h * 0.13f, 26f * u))
            text.typeface = light
            text.textSize = dateSize
            text.alpha = 245
            canvas.drawText(date, w / 2f, cy + r + dateSize * 1.55f, text)
            text.typeface = medium
            text.textSize = dateSize * 0.48f
            text.letterSpacing = 0.18f
            text.alpha = 150
            canvas.drawText(day, w / 2f, cy + r + dateSize * 2.35f, text)
        }

        // A hairline edge, as glass has.
        canvas.drawRoundRect(
            RectF(0.5f * u, 0.5f * u, w - 0.5f * u, h - 0.5f * u), corner, corner,
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = u
                color = Color.argb(28, 255, 255, 255)
            }
        )
        return bitmap
    }

    /**
     * The lit part of the moon at phase [f]: the bright half's edge, and the
     * terminator - half an ellipse, as wide as cos(2 pi f) says - back again.
     * Waxing it is lit on the right; waning, on the left.
     */
    private fun litPath(cx: Float, cy: Float, r: Float, f: Double): Path {
        val path = Path()
        val k = cos(2 * PI * f).toFloat() // 1 new, 0 a quarter, -1 full
        val rx = abs(k) * r
        val circle = RectF(cx - r, cy - r, cx + r, cy + r)
        val ellipse = RectF(cx - rx, cy - r, cx + rx, cy + r)
        val waxing = f < 0.5
        val crescent = k > 0
        path.moveTo(cx, cy - r)
        // Top to bottom round the lit side.
        path.arcTo(circle, -90f, if (waxing) 180f else -180f, false)
        // Bottom back to top along the terminator: on the lit side for a
        // crescent, bulging into the dark for a gibbous moon.
        val sweep = if (waxing == crescent) -180f else 180f
        if (rx > 0.5f) path.arcTo(ellipse, 90f, sweep, false) else path.lineTo(cx, cy - r)
        path.close()
        return path
    }

    /** A bright star with a soft glow and four fine rays. */
    private fun drawSign(canvas: Canvas, x: Float, y: Float, u: Float) {
        canvas.drawCircle(x, y, 9f * u, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                x, y, 9f * u,
                intArrayOf(Color.argb(150, 200, 215, 255), Color.argb(0, 200, 215, 255)),
                null, Shader.TileMode.CLAMP
            )
        })
        val ray = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(210, 235, 240, 255)
            strokeWidth = 0.8f * u
            strokeCap = Paint.Cap.ROUND
            maskFilter = BlurMaskFilter(0.6f * u, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawLine(x - 7f * u, y, x + 7f * u, y, ray)
        canvas.drawLine(x, y - 7f * u, x, y + 7f * u, ray)
        canvas.drawCircle(x, y, 1.8f * u, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
    }

    /** The largest size up to [most] at which [words] fit in [room]. */
    private fun fit(paint: Paint, face: Typeface, words: String, room: Float, most: Float): Float {
        paint.typeface = face
        var size = most
        while (size > 8f) {
            paint.textSize = size
            if (paint.measureText(words) <= room) break
            size -= 1f
        }
        return size
    }
}
