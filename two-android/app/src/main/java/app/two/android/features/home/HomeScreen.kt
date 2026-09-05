package app.two.android.features.home

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

@Composable
fun HomeScreen(
    spaceName: String = "Our Space",
    partnerName: String = "Partner",
    onNavigateToChat: () -> Unit,
    onNavigateToDecks: () -> Unit = {},
    onNavigateToJournal: () -> Unit,
    onNavigateToRepair: () -> Unit,
    onNavigateToNeeds: () -> Unit,
    onNavigateToMemories: () -> Unit,
    onNavigateToSettings: () -> Unit,
    onEmergencyQuickExit: () -> Unit
) {
    var userWeather by remember { mutableStateOf(WeatherState.CALM) }
    var userCapacity by remember { mutableStateOf(4) }
    var isUserNotAboutYouActive by remember { mutableStateOf(false) }

    // Partner simulated state
    val partnerWeather = WeatherState.RAINY
    val partnerCapacity = 1
    val isPartnerNotAboutYouActive = true

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.background)
                    .padding(horizontal = 24.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = spaceName,
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Encrypted Relational Sanctuary",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = MaterialTheme.colorScheme.secondary)
                    }
                    IconButton(onClick = onEmergencyQuickExit) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Quick Exit", tint = MaterialTheme.colorScheme.tertiary)
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // 1. Emotional Weather Report with Capacity
            item {
                EmotionalWeatherCard(
                    userName = "You",
                    partnerName = partnerName,
                    userWeather = userWeather,
                    userCapacity = userCapacity,
                    partnerWeather = partnerWeather,
                    partnerCapacity = partnerCapacity,
                    onUpdateUserReport = { newWeather, newCap ->
                        userWeather = newWeather
                        userCapacity = newCap
                    }
                )
            }

            // 2. The "It's Not About You" Flag
            item {
                NotAboutYouBanner(
                    isPartnerActive = isPartnerNotAboutYouActive,
                    partnerName = partnerName,
                    isUserActive = isUserNotAboutYouActive,
                    onToggleUserFlag = { isUserNotAboutYouActive = it }
                )
            }

            // 3. Waiting Trays (Unread discreet indicators)
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToChat() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.MarkEmailUnread,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "A quiet thought is waiting",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = "From $partnerName • Tap to read when you’re ready",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }
                    }
                }
            }

            // 4. Daily Question Engine (500+ Curated Library)
            item {
                val dailyQuestion = remember {
                    val dayOfYear = java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_YEAR)
                    app.two.android.core.content.QuestionLibrary.getDailyQuestion(dayOfYear, allowSpicy = false)
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "TODAY'S DAILY QUESTION",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.tertiary
                            )
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = MaterialTheme.colorScheme.surfaceVariant
                            ) {
                                Text(
                                    text = dailyQuestion.tier.name,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "“${dailyQuestion.prompt}”",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = onNavigateToChat,
                            modifier = Modifier.align(Alignment.End),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("Discuss in Chat")
                        }
                    }
                }
            }

            // 5. Resurfaced Literary Quote Jar
            item {
                val quote = remember(userWeather, userCapacity) {
                    app.two.android.core.content.LiteraryQuoteLibrary.getResurfacedQuote(
                        weather = userWeather.name,
                        capacity = userCapacity
                    )
                }
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.FormatQuote,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "RESURFACED FROM QUOTE JAR",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "“${quote.quote}”",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "— ${quote.author}${if (quote.source != null) ", ${quote.source}" else ""}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }
            }

            // 6. Intimacy & Relational Tools Grid
            item {
                Text(
                    text = "Connection & Care",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ActionCard(
                        title = "Conversation Decks",
                        subtitle = "4 connection card decks",
                        icon = Icons.Default.Layers,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToDecks
                    )
                    ActionCard(
                        title = "Ask What You Need",
                        subtitle = "Structured requests",
                        icon = Icons.Default.ChatBubbleOutline,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToNeeds
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ActionCard(
                        title = "Shared Journal",
                        subtitle = "Thoughts & drafts",
                        icon = Icons.Default.EditNote,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToJournal
                    )
                    ActionCard(
                        title = "Repair Kit",
                        subtitle = "Conflict de-escalation",
                        icon = Icons.Default.Handshake,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToRepair
                    )
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ActionCard(
                        title = "Memories & Vault",
                        subtitle = "Timeline & keepsakes",
                        icon = Icons.Default.PhotoLibrary,
                        modifier = Modifier.weight(1f),
                        onClick = onNavigateToMemories
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun ActionCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.tertiary,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.secondary
            )
        }
    }
}
