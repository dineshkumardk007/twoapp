package app.two.android.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.two.android.core.theme.AppThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentTheme: AppThemeMode,
    onThemeSelected: (AppThemeMode) -> Unit,
    onNavigateToAuditLog: () -> Unit,
    onNavigateToExport: () -> Unit,
    onEmergencyQuickExit: () -> Unit,
    onBack: () -> Unit
) {
    var isDiscreetNotificationEnabled by remember { mutableStateOf(false) }
    var isBiometricEnabled by remember { mutableStateOf(true) }
    var showQuickExitConfirm by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings & Privacy", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text("Security & Privacy", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            }

            // Biometric App Lock
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Biometric Lock & Timeout", style = MaterialTheme.typography.titleSmall)
                            Text("Requires fingerprint or face unlock upon resume", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                        }
                        Switch(checked = isBiometricEnabled, onCheckedChange = { isBiometricEnabled = it })
                    }
                }
            }

            // Discreet Notifications
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Discreet Notifications", style = MaterialTheme.typography.titleSmall)
                            Text("Hides sender name and preview completely on lock screen", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                        }
                        Switch(checked = isDiscreetNotificationEnabled, onCheckedChange = { isDiscreetNotificationEnabled = it })
                    }
                }
            }

            // Consent Audit Log
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToAuditLog() },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Consent & Access Log", style = MaterialTheme.typography.titleSmall)
                            Text("View log of location, cycle, and export events", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                    }
                }
            }

            // Data Sovereignty & Export
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToExport() },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Export Space Data", style = MaterialTheme.typography.titleSmall)
                            Text("Download local JSON, Markdown, or printable PDF", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                        }
                        Icon(Icons.Default.Download, contentDescription = null, tint = MaterialTheme.colorScheme.tertiary)
                    }
                }
            }

            // Tactile Aesthetic Themes
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("Theme & Aesthetics", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ThemeChoiceChip("Warm Linen", currentTheme == AppThemeMode.WARM_LINEN) {
                        onThemeSelected(AppThemeMode.WARM_LINEN)
                    }
                    ThemeChoiceChip("Midnight", currentTheme == AppThemeMode.MIDNIGHT_SLATE) {
                        onThemeSelected(AppThemeMode.MIDNIGHT_SLATE)
                    }
                    ThemeChoiceChip("Forest", currentTheme == AppThemeMode.FOREST_MIST) {
                        onThemeSelected(AppThemeMode.FOREST_MIST)
                    }
                }
            }

            // Emergency Exit Safe Protocol
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text("Safety", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            }

            item {
                OutlinedButton(
                    onClick = { showQuickExitConfirm = true },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Icon(Icons.Default.ExitToApp, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Emergency Quick Exit & Device Wipe")
                }
            }
        }
    }

    if (showQuickExitConfirm) {
        AlertDialog(
            onDismissRequest = { showQuickExitConfirm = false },
            title = { Text("Emergency Quick Exit", style = MaterialTheme.typography.titleLarge) },
            text = {
                Text(
                    "This immediately shreds your local encryption keys and deletes all local data from this device without notifying your partner.",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showQuickExitConfirm = false
                        onEmergencyQuickExit()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Wipe Device Now")
                }
            },
            dismissButton = {
                TextButton(onClick = { showQuickExitConfirm = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun ThemeChoiceChip(
    title: String,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    FilterChip(
        selected = isSelected,
        onClick = onSelect,
        label = { Text(title) }
    )
}
