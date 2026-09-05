package app.two.android.features.decks

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.two.android.core.content.ConversationDeck
import app.two.android.core.content.DeckCard
import app.two.android.core.content.DeckLibrary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DecksScreen(
    onBack: () -> Unit,
    onSendPromptToChat: (deckTitle: String, promptText: String) -> Unit = { _, _ -> }
) {
    var selectedDeckIndex by remember { mutableIntStateOf(0) }
    var currentCardIndex by remember { mutableIntStateOf(0) }
    var reflectionText by remember { mutableStateOf("") }
    var showSentSnackbar by remember { mutableStateOf(false) }

    val decks = DeckLibrary.decks
    val currentDeck: ConversationDeck = decks[selectedDeckIndex]
    val currentCard: DeckCard = currentDeck.cards[currentCardIndex.coerceIn(0, currentDeck.cards.size - 1)]

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Conversation Decks", style = MaterialTheme.typography.titleLarge) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Curated prompts designed to deepen emotional safety, intuitive knowledge, and closeness. No scoring, no winners.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.secondary
            )

            // Deck Selector Chips / Cards
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items(decks.indices.toList()) { index ->
                    val deck = decks[index]
                    val isSelected = index == selectedDeckIndex
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.clickable {
                            selectedDeckIndex = index
                            currentCardIndex = 0
                            reflectionText = ""
                        }
                    ) {
                        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                            Text(
                                text = deck.title,
                                style = MaterialTheme.typography.labelMedium,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "${deck.cards.size} prompts",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isSelected) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f) else MaterialTheme.colorScheme.secondary
                            )
                        }
                    }
                }
            }

            // Active Card Area with tactile styling
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Card Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = currentDeck.title.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.tertiary
                        )
                        Text(
                            text = "${currentCardIndex + 1} / ${currentDeck.cards.size}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }

                    // Card Prompt Body
                    AnimatedContent(
                        targetState = currentCard,
                        transitionSpec = { fadeIn() togetherWith fadeOut() },
                        label = "CardPromptAnimation"
                    ) { card ->
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(vertical = 16.dp)
                        ) {
                            Text(
                                text = "“${card.prompt}”",
                                style = MaterialTheme.typography.headlineMedium,
                                textAlign = TextAlign.Center,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(horizontal = 8.dp)
                            )
                            if (card.subtext != null) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = card.subtext,
                                    style = MaterialTheme.typography.bodySmall,
                                    fontStyle = FontStyle.Italic,
                                    color = MaterialTheme.colorScheme.secondary,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }

                    // Card Navigation Controls
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                currentCardIndex = (currentCardIndex - 1 + currentDeck.cards.size) % currentDeck.cards.size
                                reflectionText = ""
                            }
                        ) {
                            Icon(Icons.Default.ArrowBackIosNew, contentDescription = "Previous Card", tint = MaterialTheme.colorScheme.primary)
                        }

                        IconButton(
                            onClick = {
                                currentCardIndex = (0 until currentDeck.cards.size).random()
                                reflectionText = ""
                            }
                        ) {
                            Icon(Icons.Default.Shuffle, contentDescription = "Random Shuffle", tint = MaterialTheme.colorScheme.tertiary)
                        }

                        IconButton(
                            onClick = {
                                currentCardIndex = (currentCardIndex + 1) % currentDeck.cards.size
                                reflectionText = ""
                            }
                        ) {
                            Icon(Icons.Default.ArrowForwardIos, contentDescription = "Next Card", tint = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }

            // In-Card Reflection & Prompt To Chat Actions
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Share this prompt or your answer:",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = reflectionText,
                        onValueChange = { reflectionText = it },
                        placeholder = { Text("Write your thoughts or response...") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface
                        )
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = {
                                onSendPromptToChat(currentDeck.title, currentCard.prompt)
                                showSentSnackbar = true
                            }
                        ) {
                            Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Send Prompt")
                        }

                        if (reflectionText.isNotBlank()) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    onSendPromptToChat(currentDeck.title, "Prompt: “${currentCard.prompt}”\nAnswer: $reflectionText")
                                    reflectionText = ""
                                    showSentSnackbar = true
                                }
                            ) {
                                Text("Post Answer")
                            }
                        }
                    }
                    if (showSentSnackbar) {
                        Text(
                            text = "✓ Sent to encrypted space chat!",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
