package app.two.android.features.repair

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
import androidx.compose.ui.unit.dp

data class AgreementItem(
    val id: String,
    val title: String,
    val trigger: String,
    val resolution: String,
    val date: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RepairKitScreen(
    partnerName: String = "Partner",
    onBack: () -> Unit
) {
    var repairStep by remember { mutableStateOf(1) } // 1: Cool-down, 2: Private Reflection, 3: Reveal, 4: Agreement Log

    // Reflection state
    var feltText by remember { mutableStateOf("") }
    var neededText by remember { mutableStateOf("") }
    var myPartText by remember { mutableStateOf("") }
    var isSubmitted by remember { mutableStateOf(false) }

    // Mock partner status
    val isPartnerSubmitted = true

    // Agreement Log
    var agreements by remember {
        mutableStateOf(
            listOf(
                AgreementItem(
                    id = "1",
                    title = "Tone when rushed before leaving",
                    trigger = "When we are running late and tensions rise",
                    resolution = "Whoever is driving takes over departure timing. We pause and breathe before speaking abruptly.",
                    date = "Last Month"
                )
            )
        )
    }
    var searchQuery by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Conflict Repair Kit", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    TextButton(onClick = { repairStep = 4 }) {
                        Text("Agreement Log", color = MaterialTheme.colorScheme.tertiary)
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
            when (repairStep) {
                1 -> {
                    // Step 1: Cool-Down Timer
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Step 1: Agreed Cool-Down", style = MaterialTheme.typography.headlineMedium)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                "When emotions are high, cognitive processing narrows. Agree on a quiet pause interval before trying to solve anything.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.secondary
                            )

                            Spacer(modifier = Modifier.height(32.dp))

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                            ) {
                                Column(
                                    modifier = Modifier.padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text("Suggested Pause", style = MaterialTheme.typography.labelSmall)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("45 Minutes", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("Time to decompress, hydrate, and reflect.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
                                }
                            }
                        }

                        Button(
                            onClick = { repairStep = 2 },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Begin Private Reflection", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }

                2 -> {
                    // Step 2: Private Reflection Prompts
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            item {
                                Text("Step 2: Private Reflections", style = MaterialTheme.typography.headlineMedium)
                                Text(
                                    "Your answers stay locked under your private key until both of you tap submit. No one can read them early.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }

                            item {
                                OutlinedTextField(
                                    value = feltText,
                                    onValueChange = { feltText = it },
                                    label = { Text("What did I feel in that moment?") },
                                    placeholder = { Text("e.g., Unheard, dismissed, anxious...") },
                                    modifier = Modifier.fillMaxWidth().height(100.dp),
                                    shape = RoundedCornerShape(12.dp)
                                )
                            }

                            item {
                                OutlinedTextField(
                                    value = neededText,
                                    onValueChange = { neededText = it },
                                    label = { Text("What did I need that I wasn’t getting?") },
                                    placeholder = { Text("e.g., Validation, gentleness, time to finish...") },
                                    modifier = Modifier.fillMaxWidth().height(100.dp),
                                    shape = RoundedCornerShape(12.dp)
                                )
                            }

                            item {
                                OutlinedTextField(
                                    value = myPartText,
                                    onValueChange = { myPartText = it },
                                    label = { Text("What was my part in how things unfolded?") },
                                    placeholder = { Text("e.g., My tone was sharp, I withdrew defensively...") },
                                    modifier = Modifier.fillMaxWidth().height(100.dp),
                                    shape = RoundedCornerShape(12.dp)
                                )
                            }
                        }

                        Button(
                            onClick = {
                                isSubmitted = true
                                repairStep = 3
                            },
                            enabled = feltText.isNotBlank() && neededText.isNotBlank() && myPartText.isNotBlank(),
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Lock & Reveal Simultaneously", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }

                3 -> {
                    // Step 3: Simultaneous Reveal & Resolution
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            item {
                                Text("Step 3: Shared Perspective", style = MaterialTheme.typography.headlineMedium)
                                Text("Both reflections are now unlocked. Review each other’s inner experience with curiosity, not defense.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
                            }

                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text("$partnerName’s Perspective", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text("Felt: Overwhelmed by the sudden question.\nNeeded: A few minutes to transition.\nTheir part: Snapped instead of expressing need for time.", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }

                            item {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                    shape = RoundedCornerShape(16.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text("Your Perspective", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text("Felt: $feltText\nNeeded: $neededText\nYour part: $myPartText", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }

                        Button(
                            onClick = {
                                // Save agreement to log
                                val newAgreement = AgreementItem(
                                    id = System.currentTimeMillis().toString(),
                                    title = "Transitioning before serious topics",
                                    trigger = "When one partner is decompressing after work",
                                    resolution = "We check capacity first: 'Do you have capacity for a logistical question right now?'",
                                    date = "Today"
                                )
                                agreements = listOf(newAgreement) + agreements
                                repairStep = 4
                            },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Save Agreement to Permanent Log", style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }

                4 -> {
                    // Step 4: Searchable Agreement Log
                    Column(modifier = Modifier.fillMaxSize()) {
                        Text("Searchable Agreement Log", style = MaterialTheme.typography.headlineMedium)
                        Text("Past resolutions are indexed on-device so you never restart arguments from zero.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search agreements by keyword...") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        val filtered = agreements.filter {
                            it.title.contains(searchQuery, ignoreCase = true) ||
                            it.resolution.contains(searchQuery, ignoreCase = true)
                        }

                        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(filtered) { item ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(item.title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                                            Text(item.date, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                                        }
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text("When: ${item.trigger}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text("Our Agreement: ${item.resolution}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
