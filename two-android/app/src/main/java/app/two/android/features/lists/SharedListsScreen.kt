package app.two.android.features.lists

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.unit.dp

data class ListItem(
    val id: String,
    val title: String,
    val isCompleted: Boolean,
    val isHiddenFromPartner: Boolean = false // Surprise gift toggle
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedListsScreen(
    partnerName: String = "Partner",
    onBack: () -> Unit
) {
    var items by remember {
        mutableStateOf(
            listOf(
                ListItem("1", "Weekend pottery class", false),
                ListItem("2", "Watch the Studio Ghibli film", true),
                ListItem("3", "Surprise anniversary weekend getaway", false, isHiddenFromPartner = true)
            )
        )
    }

    var newItemTitle by remember { mutableStateOf("") }
    var isNewItemSecret by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Shared Lists & Date Ideas", style = MaterialTheme.typography.titleLarge) },
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
                .padding(horizontal = 24.dp)
        ) {
            Text(
                text = "Collaborative Lists with Surprise Protection",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.secondary
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Add Item Box
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    OutlinedTextField(
                        value = newItemTitle,
                        onValueChange = { newItemTitle = it },
                        placeholder = { Text("Add an idea or gift...") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = isNewItemSecret,
                                onCheckedChange = { isNewItemSecret = it }
                            )
                            Text(
                                text = "Hide from $partnerName (Secret / Gift)",
                                style = MaterialTheme.typography.labelSmall
                            )
                        }

                        Button(
                            onClick = {
                                if (newItemTitle.isNotBlank()) {
                                    items = items + ListItem(
                                        id = System.currentTimeMillis().toString(),
                                        title = newItemTitle,
                                        isCompleted = false,
                                        isHiddenFromPartner = isNewItemSecret
                                    )
                                    newItemTitle = ""
                                    isNewItemSecret = false
                                }
                            },
                            enabled = newItemTitle.isNotBlank()
                        ) {
                            Text("Add")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(items) { item ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (item.isHiddenFromPartner) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                Checkbox(
                                    checked = item.isCompleted,
                                    onCheckedChange = { checked ->
                                        items = items.map { if (it.id == item.id) it.copy(isCompleted = checked) else it }
                                    }
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        text = item.title,
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = if (item.isCompleted) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
                                    )
                                    if (item.isHiddenFromPartner) {
                                        Text(
                                            text = "🎁 Hidden from $partnerName until revealed",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.tertiary
                                        )
                                    }
                                }
                            }

                            IconButton(
                                onClick = { items = items.filter { it.id != item.id } }
                            ) {
                                Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = MaterialTheme.colorScheme.secondary)
                            }
                        }
                    }
                }
            }
        }
    }
}
