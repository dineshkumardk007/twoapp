package app.two.android.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.two.android.core.theme.*

enum class WeatherState(val label: String, val icon: String) {
    SUNNY("Sunny", "☀️"),
    CALM("Clear", "🌤️"),
    OVERCAST("Overcast", "☁️"),
    RAINY("Turbulent", "🌧️"),
    STORMY("Stormy", "⛈️")
}

@Composable
fun EmotionalWeatherCard(
    userName: String = "You",
    partnerName: String = "Partner",
    userWeather: WeatherState = WeatherState.CALM,
    userCapacity: Int = 4,
    partnerWeather: WeatherState = WeatherState.OVERCAST,
    partnerCapacity: Int = 1,
    onUpdateUserReport: (WeatherState, Int) -> Unit
) {
    var showEditDialog by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { showEditDialog = true },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Emotional Weather & Capacity",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Tap to update",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Partner Status
                WeatherReportColumn(
                    name = partnerName,
                    weather = partnerWeather,
                    capacity = partnerCapacity,
                    modifier = Modifier.weight(1f)
                )

                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(80.dp)
                        .background(MaterialTheme.colorScheme.outline)
                )

                // User Status
                WeatherReportColumn(
                    name = userName,
                    weather = userWeather,
                    capacity = userCapacity,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }

    if (showEditDialog) {
        EditWeatherDialog(
            currentWeather = userWeather,
            currentCapacity = userCapacity,
            onDismiss = { showEditDialog = false },
            onSave = { newWeather, newCap ->
                onUpdateUserReport(newWeather, newCap)
                showEditDialog = false
            }
        )
    }
}

@Composable
private fun WeatherReportColumn(
    name: String,
    weather: WeatherState,
    capacity: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(horizontal = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = name,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "${weather.icon} ${weather.label}",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(8.dp))

        // 0-5 Capacity Dots Gauge
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (i in 1..5) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (i <= capacity) CapacityActive else CapacityInactive)
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Capacity: $capacity/5",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.secondary
        )
    }
}

@Composable
private fun EditWeatherDialog(
    currentWeather: WeatherState,
    currentCapacity: Int,
    onDismiss: () -> Unit,
    onSave: (WeatherState, Int) -> Unit
) {
    var selectedWeather by remember { mutableStateOf(currentWeather) }
    var capacity by remember { mutableStateOf(currentCapacity.toFloat()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Update Your Emotional State", style = MaterialTheme.typography.titleLarge) },
        text = {
            Column {
                Text("How are you feeling today?", style = MaterialTheme.typography.bodyMedium)
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    WeatherState.values().forEach { state ->
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (selectedWeather == state) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                                .clickable { selectedWeather = state },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(state.icon, style = MaterialTheme.typography.titleLarge)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text("Emotional Capacity: ${capacity.toInt()}/5", style = MaterialTheme.typography.bodyMedium)
                Text("How much emotional bandwidth do you have to give?", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)

                Slider(
                    value = capacity,
                    onValueChange = { capacity = it },
                    valueRange = 0f..5f,
                    steps = 4
                )
            }
        },
        confirmButton = {
            Button(onClick = { onSave(selectedWeather, capacity.toInt()) }) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
