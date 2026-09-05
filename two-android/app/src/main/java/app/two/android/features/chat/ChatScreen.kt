package app.two.android.features.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

data class ChatMessage(
    val id: String,
    val senderName: String,
    val text: String,
    val timestamp: String,
    val isFromMe: Boolean,
    val isNeedCard: Boolean = false,
    val isVoiceMemo: Boolean = false,
    val audioDurationSeconds: Int = 0
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    partnerName: String = "Partner",
    onBack: () -> Unit
) {
    var messages by remember {
        mutableStateOf(
            listOf(
                ChatMessage("1", partnerName, "Hey, how is your afternoon going?", "2:15 PM", false),
                ChatMessage("2", "You", "A little hectic, but taking a deep breath.", "2:18 PM", true),
                ChatMessage("3", partnerName, "Thinking of you. Take all the time you need.", "2:20 PM", false),
                ChatMessage("4", "You", "🎙️ Whisper voice note", "2:22 PM", true, isVoiceMemo = true, audioDurationSeconds = 14)
            )
        )
    }

    var textInput by remember { mutableStateOf("") }
    var showNeedMenu by remember { mutableStateOf(false) }
    val listState = androidx.compose.foundation.lazy.rememberLazyListState()

    // Auto-scroll to the bottom when new message is appended
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(partnerName, style = MaterialTheme.typography.titleLarge)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(MaterialTheme.colorScheme.tertiary))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("End-to-End Encrypted", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showNeedMenu = true }) {
                        Icon(Icons.Default.HelpOutline, contentDescription = "Ask for need", tint = MaterialTheme.colorScheme.tertiary)
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
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages) { msg ->
                    ChatBubble(msg)
                }
            }

            // Chat Input Bar
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { showNeedMenu = true },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(Icons.Default.AddCircleOutline, contentDescription = "Special actions", tint = MaterialTheme.colorScheme.tertiary)
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = textInput,
                        onValueChange = { textInput = it },
                        placeholder = { Text("Write a private thought...") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp),
                        maxLines = 4,
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            unfocusedBorderColor = androidx.compose.ui.graphics.Color.Transparent
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(
                        onClick = {
                            messages = messages + ChatMessage(
                                id = System.currentTimeMillis().toString(),
                                senderName = "You",
                                text = "🎙️ Whisper voice note",
                                timestamp = "Just now",
                                isFromMe = true,
                                isVoiceMemo = true,
                                audioDurationSeconds = 12
                            )
                        },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(Icons.Default.Mic, contentDescription = "Voice Note", tint = MaterialTheme.colorScheme.primary)
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    IconButton(
                        onClick = {
                            if (textInput.isNotBlank()) {
                                messages = messages + ChatMessage(
                                    id = System.currentTimeMillis().toString(),
                                    senderName = "You",
                                    text = textInput,
                                    timestamp = "Just now",
                                    isFromMe = true
                                )
                                textInput = ""
                            }
                        },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.surface)
                    }
                }
            }
        }
    }

    if (showNeedMenu) {
        NeedMenuBottomSheet(
            onDismiss = { showNeedMenu = false },
            onNeedSelected = { need ->
                messages = messages + ChatMessage(
                    id = System.currentTimeMillis().toString(),
                    senderName = "You",
                    text = "I need: ${need.title} — ${need.description}",
                    timestamp = "Just now",
                    isFromMe = true,
                    isNeedCard = true
                )
                showNeedMenu = false
            }
        )
    }
}

@Composable
private fun ChatBubble(message: ChatMessage) {
    val alignment = if (message.isFromMe) Alignment.End else Alignment.Start
    val background = if (message.isFromMe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
    val textColor = if (message.isFromMe) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.primary
    var isPlaying by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (message.isFromMe) 16.dp else 4.dp,
                        bottomEnd = if (message.isFromMe) 4.dp else 16.dp
                    )
                )
                .background(background)
                .padding(12.dp)
        ) {
            Column {
                if (message.isNeedCard) {
                    Text(
                        text = "🌱 Structured Need Request",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }

                if (message.isVoiceMemo) {
                    // Calming Voice Memo Audio Bubble
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        IconButton(
                            onClick = { isPlaying = !isPlaying },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(if (message.isFromMe) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.primary)
                        ) {
                            Icon(
                                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = "Play/Pause",
                                tint = if (message.isFromMe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                val barHeights = listOf(8, 14, 22, 16, 26, 18, 12, 20, 24, 15, 10)
                                barHeights.forEach { h ->
                                    Box(
                                        modifier = Modifier
                                            .width(3.dp)
                                            .height(h.dp)
                                            .clip(RoundedCornerShape(2.dp))
                                            .background(textColor.copy(alpha = 0.7f))
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Whisper Note • 0:${if (message.audioDurationSeconds < 10) "0" else ""}${message.audioDurationSeconds}",
                                style = MaterialTheme.typography.labelSmall,
                                color = textColor.copy(alpha = 0.8f)
                            )
                        }
                    }
                } else {
                    Text(
                        text = message.text,
                        style = MaterialTheme.typography.bodyMedium,
                        color = textColor
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = message.timestamp,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor.copy(alpha = 0.7f),
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    }
}
