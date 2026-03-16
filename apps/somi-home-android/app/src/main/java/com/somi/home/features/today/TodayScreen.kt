package com.somi.home.features.today

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.somi.home.R
import com.somi.home.core.models.ExerciseParams
import com.somi.home.core.models.TodayAssignment
import com.somi.home.ui.components.EmptyStateView
import com.somi.home.ui.components.LoadingSkeleton
import com.somi.home.ui.components.ParameterChipsRow
import com.somi.home.ui.components.SyncBadge
import com.somi.home.ui.theme.SomiNavy
import com.somi.home.ui.theme.SomiTeal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    viewModel: TodayViewModel = hiltViewModel(),
    onNavigateToExerciseDetail: (assignmentKey: String, sessionKey: String) -> Unit = { _, _ -> }
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Reload when returning from exercise detail
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadToday()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Show error snackbar
    val errorMessage = (uiState as? TodayUiState.Success)?.errorMessage
    LaunchedEffect(errorMessage) {
        if (errorMessage != null) {
            snackbarHostState.showSnackbar(errorMessage)
            viewModel.clearErrorMessage()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val state = uiState) {
            is TodayUiState.Loading -> LoadingSkeleton()

            is TodayUiState.Error -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadToday() }) {
                        Text("Retry")
                    }
                }
            }

            is TodayUiState.Success -> {
                val data = state.data
                if (data.assignments.isEmpty()) {
                    EmptyStateView(
                        title = stringResource(R.string.no_exercises_today),
                        message = "Check back later or view your full plan.",
                        icon = Icons.Outlined.FitnessCenter
                    )
                } else if (viewModel.isAllDoneForDay(data)) {
                    AllDoneView()
                } else {
                    val currentOcc = viewModel.currentOccurrence(data)

                    PullToRefreshBox(
                        isRefreshing = false,
                        onRefresh = { viewModel.loadToday() },
                        modifier = Modifier.fillMaxSize()
                    ) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            item {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Today",
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = SomiNavy
                                )
                            }

                            if (pendingCount > 0) {
                                item {
                                    SyncBadge(pendingCount = pendingCount)
                                }
                            }

                            if (data.sessionTitle != null) {
                                item {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = data.sessionTitle,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = SomiNavy.copy(alpha = 0.7f)
                                    )
                                    if (data.timesPerDay > 1) {
                                        val completedRounds = completedRoundsToday(data.assignments, data.timesPerDay)
                                        Text(
                                            text = "$completedRounds / ${data.timesPerDay} times today",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = SomiNavy.copy(alpha = 0.5f)
                                        )
                                    }
                                }
                            }

                            items(
                                items = data.assignments,
                                key = { it.assignmentKey }
                            ) { assignment ->
                                // isComplete tracks the current occurrence only (session-gated)
                                val isCompleteForCurrentOcc = assignment.completions
                                    .any { it.occurrence == currentOcc && it.completed }
                                AssignmentRow(
                                    assignment = assignment,
                                    isComplete = isCompleteForCurrentOcc,
                                    onToggle = {
                                        if (isCompleteForCurrentOcc) {
                                            viewModel.markIncomplete(
                                                sessionKey = data.sessionKey,
                                                assignmentKey = assignment.assignmentKey,
                                                exerciseVersionId = assignment.exerciseVersionId,
                                                occurrence = currentOcc
                                            )
                                        } else {
                                            viewModel.markComplete(
                                                sessionKey = data.sessionKey,
                                                assignmentKey = assignment.assignmentKey,
                                                exerciseVersionId = assignment.exerciseVersionId,
                                                occurrence = currentOcc
                                            )
                                        }
                                    },
                                    onClick = {
                                        onNavigateToExerciseDetail(
                                            assignment.assignmentKey,
                                            data.sessionKey
                                        )
                                    }
                                )
                            }

                            // Session notes
                            if (!data.sessionNotes.isNullOrBlank()) {
                                item {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = SomiTeal.copy(alpha = 0.08f),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(modifier = Modifier.padding(16.dp)) {
                                            Text(
                                                text = "Notes from your therapist",
                                                style = MaterialTheme.typography.labelLarge,
                                                fontWeight = FontWeight.SemiBold,
                                                color = SomiNavy
                                            )
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = data.sessionNotes,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = SomiNavy.copy(alpha = 0.7f)
                                            )
                                        }
                                    }
                                }
                            }

                            item { Spacer(modifier = Modifier.height(16.dp)) }
                        }
                    }

                    // Congrats modal — shown after completing a round when more rounds remain
                    if (state.showCongratsModal) {
                        CongratsDialog(
                            roundsCompleted = state.completedRoundsForModal,
                            totalRounds = data.timesPerDay,
                            onDismiss = { viewModel.dismissCongratsModal() }
                        )
                    }
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

// MARK: - All Done View

@Composable
private fun AllDoneView() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        Icon(
            imageVector = Icons.Filled.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = SomiTeal
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Great work today! \uD83C\uDF89",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = SomiNavy,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "You've completed all of your exercises for today. Take care and we'll see you tomorrow!",
            style = MaterialTheme.typography.bodyLarge,
            color = SomiNavy.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(40.dp))
    }
}

// MARK: - Congrats Dialog

@Composable
private fun CongratsDialog(
    roundsCompleted: Int,
    totalRounds: Int,
    onDismiss: () -> Unit
) {
    val ordinal = when (roundsCompleted) {
        1 -> "1st"; 2 -> "2nd"; 3 -> "3rd"; else -> "${roundsCompleted}th"
    }
    val remaining = totalRounds - roundsCompleted

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(SomiTeal.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Star,
                    contentDescription = null,
                    modifier = Modifier.size(44.dp),
                    tint = SomiTeal
                )
            }
        },
        title = {
            Text(
                text = "Round complete!",
                textAlign = TextAlign.Center,
                color = SomiNavy,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = "You've finished your $ordinal round of exercises. Keep it up — $remaining more to go!",
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = SomiTeal),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Keep going!", color = Color.White)
            }
        },
        containerColor = Color.White
    )
}

// MARK: - Exercise row helpers

/** Count how many full rounds (all exercises completed) have been done today. */
private fun completedRoundsToday(assignments: List<TodayAssignment>, timesPerDay: Int): Int {
    var count = 0
    for (round in 1..timesPerDay) {
        val allDone = assignments.all { a -> a.completions.any { it.occurrence == round && it.completed } }
        if (allDone) count++
    }
    return count
}

@Composable
private fun AssignmentRow(
    assignment: TodayAssignment,
    isComplete: Boolean,
    onToggle: () -> Unit,
    onClick: () -> Unit
) {
    val params = assignment.effectiveParams ?: ExerciseParams(null, null, null)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Single completion circle for the current occurrence
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(
                        if (isComplete) SomiTeal else Color.Transparent
                    )
                    .then(
                        if (!isComplete) Modifier.background(
                            color = SomiTeal.copy(alpha = 0.12f),
                            shape = CircleShape
                        ) else Modifier
                    )
                    .clickable(onClick = onToggle)
                    .testTag("completion_circle_${assignment.assignmentKey}"),
                contentAlignment = Alignment.Center
            ) {
                if (isComplete) {
                    Text(
                        text = "✓",
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Exercise info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = assignment.exercise.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = SomiNavy
                )
                Spacer(modifier = Modifier.height(4.dp))
                ParameterChipsRow(params = params)
            }

            // Chevron
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "View details",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
        }
    }
}
