package app.two.android.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.*
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import app.two.android.MainActivity

/**
 * Jetpack Glance home screen widget.
 * Shows the partner's emotional weather, capacity (0-5), and unread indicators ambiently.
 */
class PartnerMoodGlanceWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            GlanceWidgetContent()
        }
    }

    @Composable
    private fun GlanceWidgetContent() {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ImageProvider(android.R.drawable.dialog_holo_light_frame))
                .padding(16.dp)
                .clickable(actionStartActivity<MainActivity>()),
            verticalAlignment = Alignment.CenterVertically,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Partner's Status",
                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium)
            )

            Spacer(modifier = GlanceModifier.height(4.dp))

            Text(
                text = "🌤️ Clear • Capacity: 4/5",
                style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold)
            )

            Spacer(modifier = GlanceModifier.height(4.dp))

            Text(
                text = "✉️ Note waiting for you",
                style = TextStyle(fontSize = 11.sp)
            )
        }
    }
}

class PartnerMoodWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PartnerMoodGlanceWidget()
}
