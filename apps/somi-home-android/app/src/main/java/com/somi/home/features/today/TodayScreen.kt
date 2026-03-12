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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.somi.home.R
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.TodaySession
import com.somi.home.ui.components.EmptyStateView
import com.somi.home.ui.components.LoadingSkeleton
import com.somi.home.ui.components.ParameterChipsRow
import com.somi.home.ui.components.SyncBadge
import com.somi.home.ui.components.effectiveParams
import com.somi.home.ui.theme.SomiNavy
import com.somi.home.ui.theme.SomiTeal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    viewModel: TodayViewModel = hiltViewModel(),
    onNavigateToExerciseDetail: (assignmentKey: String, sessionKey: String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val pendingCount by viewModel.pendingCount.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

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
                if (data.sessions.isEmpty() || data.sessions.all { it.assignments.isEmpty() }) {
                    EmptyStateView(
                        title = stringResource(R.string.no_exercises_today),
                        message = "Check back later or view your full plan.",
                        icon = Icons.Outlined.FitnessCenter
                    )
                } else {
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
                                    color = SomiNavy
                                )
                            }

                            if (pendingCount > 0) {
                                item {
                                    SyncBadge(pendingCount = pendingCount)
                                }
                            }

                            data.sessions.forEach { session ->
                                if (session.title != null) {
                                    item {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = session.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }

                                items(
                                    items = session.assignments,
                                    key = { it.assignmentKey }
                                ) { assignment ->
                                    AssignmentRow(
                                        assignment = assignment,
                                        session = session,
                                        onComplete = { occurrence ->
                                            viewModel.markComplete(
                                                sessionKey = session.sessionKey,
                                                assignmentKey = assignment.assignmentKey,
                                                exerciseVersionId = assignment.exerciseVersionId,
                                                occurrence = occurrence
                                            )
                                        },
                                        onClick = {
                                            onNavigateToExerciseDetail(
                                                assignment.assignmentKey,
                                                session.sessionKey
                                            )
                                        }
                                    )
                                }
                            }

                            item { Spacer(modifier = Modifier.height(16.dp)) }
                        }
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

@Composable
private fun AssignmentRow(
    assignment: TodayAssignment,
    session: TodaySession,
    onComplete: (Int) -> Unit,
    onClick: () -> Unit
) {
    val completedOccurrences = assignment.completions.map { it.occurrence }.toSet()
    val params = effectiveParams(assignment.exercise.defaultParams, assignment.paramsOverride)

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
            // Completion circles
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                (1..session.timesPerDay).forEach { occurrence ->
                    val isCompleted = occurrence in completedOccurrences
                    IconButton(
                        onClick = { if (!isCompleted) onComplete(occurrence) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = if (isCompleted) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                            contentDescription = if (isCompleted) "Completed" else "Mark complete",
                            tint = if (isCompleted) SomiTeal else SomiTeal.copy(alpha = 0.4f),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Exercise info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = assignment.exercise.title,
                    style = MaterialTheme.typography.titleMedium
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
