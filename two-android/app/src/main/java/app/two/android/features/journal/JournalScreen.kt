package app.two.android.features.journal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

data class JournalEntry(
    val id: String,
    val author: String,
    val title: String,
    val content: String,
    val date: String,
    val isPrivate: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JournalScreen(
    partnerName: String = "Partner",
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Shared Feed, 1: Private To You
    var showNewEntryDialog by remember { mutableStateOf(false) }

    var sharedEntries by remember {
        mutableStateOf(
            listOf(
                JournalEntry("1", partnerName, "A quiet moment this morning", "Woke up early and listened to the rain. Feeling grateful for our calm home.", "Yesterday"),
                JournalEntry("2", "You", "Sunday walk thoughts", "Walking through the park today reminded me of our first trip together. Loved that quiet feeling.", "3 days ago")
            )
        )
    }

    var privateEntries by remember {
        mutableStateOf(
            listOf(
                JournalEntry("101", "You", "Processing work frustration", "Felt really depleted after that meeting today. Writing it out here so I don’t bring the irritation home.", "Today", isPrivate = true)
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Thought & Mood Journal", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showNewEntryDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "New Entry", tint = MaterialTheme.colorScheme.tertiary)
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
                .padding(horizontal = 20.dp)
        ) {
            TabRow(
                selectedTabIndex = selectedTab,
                modifier = Modifier.clip(RoundedCornerShape(12.dp)),
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Shared Space") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Private to You")
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (selectedTab == 0) {
                // Shared Feed
                LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    items(sharedEntries) { entry ->
                        JournalCard(entry = entry, onPromote = {})
                    }
                }
            } else {
                // Private Tab
                Column {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Text(
                            text = "🔒 Encrypted with your owner-only key. Your partner cannot decrypt or read these drafts until you explicitly share them.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.padding(12.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        items(privateEntries) { entry ->
                            JournalCard(
                                entry = entry,
                                onPromote = {
                                    // Move from private to shared
                                    privateEntries = privateEntries.filter { it.id != entry.id }
                                    sharedEntries = listOf(entry.copy(isPrivate = false, author = "You")) + sharedEntries
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showNewEntryDialog) {
        NewEntryDialog(
            isPrivateInitial = selectedTab == 1,
            onDismiss = { showNewEntryDialog = false },
            onSave = { title, content, isPrivate ->
                val newEntry = JournalEntry(
                    id = System.currentTimeMillis().toString(),
                    author = "You",
                    title = title,
                    content = content,
                    date = "Today",
                    isPrivate = isPrivate
                )
                if (isPrivate) {
                    privateEntries = listOf(newEntry) + privateEntries
                } else {
                    sharedEntries = listOf(newEntry) + sharedEntries
                }
                showNewEntryDialog = false
            }
        )
    }
}

@Composable
private fun JournalCard(
    entry: JournalEntry,
    onPromote: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(entry.author, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.tertiary)
                Text(entry.date, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(entry.title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)

            Spacer(modifier = Modifier.height(6.dp))

            Text(entry.content, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)

            if (entry.isPrivate) {
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onPromote,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Promote to Shared Space", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable
private fun NewEntryDialog(
    isPrivateInitial: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String, Boolean) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var isPrivate by remember { mutableStateOf(isPrivateInitial) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Write Entry", style = MaterialTheme.typography.titleLarge) },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = content,
                    onValueChange = { content = it },
                    label = { Text("Write your thoughts...") },
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    maxLines = 8
                )
                Spacer(modifier = Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isPrivate, onCheckedChange = { isPrivate = it })
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Private to me (owner-only subkey)", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank() && content.isNotBlank()) onSave(title, content, isPrivate) },
                enabled = title.isNotBlank() && content.isNotBlank()
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
