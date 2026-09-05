package app.two.android.features.lists

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class ExpenseItem(
    val id: String,
    val title: String,
    val amount: Double,
    val paidBy: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoneyLightScreen(
    partnerName: String = "Partner",
    onBack: () -> Unit
) {
    var expenses by remember {
        mutableStateOf(
            listOf(
                ExpenseItem("1", "Weekly farmer's market groceries", 64.50, "You"),
                ExpenseItem("2", "Electricity & water bill", 112.00, partnerName)
            )
        )
    }

    val totalPaidByMe = expenses.filter { it.paidBy == "You" }.sumOf { it.amount }
    val totalPaidByPartner = expenses.filter { it.paidBy == partnerName }.sumOf { it.amount }
    val diff = (totalPaidByMe - totalPaidByPartner) / 2.0

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Money-Light Shared Tab", style = MaterialTheme.typography.titleLarge) },
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
            // Balance Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Current Running Balance", style = MaterialTheme.typography.labelSmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (diff > 0) "$partnerName owes you $${"%.2f".format(diff)}"
                               else if (diff < 0) "You owe $partnerName $${"%.2f".format(-diff)}"
                               else "Your space is completely settled",
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { expenses = emptyList() },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Settle Up Tab")
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text("Recent Shared Purchases", style = MaterialTheme.typography.titleMedium)

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(expenses) { expense ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(expense.title, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.primary)
                                Text("Paid by ${expense.paidBy}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                            }
                            Text("$${"%.2f".format(expense.amount)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.tertiary)
                        }
                    }
                }
            }
        }
    }
}
