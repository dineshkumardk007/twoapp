package app.two.android.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.two.android.core.theme.NotAboutYouGold

@Composable
fun NotAboutYouBanner(
    isPartnerActive: Boolean,
    partnerName: String,
    isUserActive: Boolean,
    onToggleUserFlag: (Boolean) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        if (isPartnerActive) {
            // Calming Banner for Partner's state
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = NotAboutYouGold.copy(alpha = 0.15f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, NotAboutYouGold)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Favorite,
                        contentDescription = null,
                        tint = NotAboutYouGold,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "It’s not about you",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "$partnerName is having a rough day, but it isn’t caused by you. Please don’t read into their quietness or tone.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }
            }
        }

        // Quick 1-Tap Toggle for User's own flag
        OutlinedButton(
            onClick = { onToggleUserFlag(!isUserActive) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = if (isUserActive) NotAboutYouGold else MaterialTheme.colorScheme.secondary
            ),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                if (isUserActive) NotAboutYouGold else MaterialTheme.colorScheme.outline
            )
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isUserActive) Icons.Default.Favorite else Icons.Default.Info,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isUserActive) "Active: “It’s not about you” flag set" else "Set “It’s not about you” flag for today",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}
