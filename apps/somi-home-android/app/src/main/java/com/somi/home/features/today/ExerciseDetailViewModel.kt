package com.somi.home.features.today

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.ExerciseParams
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.UncompletionRequest
import com.somi.home.core.network.ApiService
import com.somi.home.core.sync.CompletionSyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject

sealed class ExerciseDetailUiState {
    data object Loading : ExerciseDetailUiState()
    data class Success(
        val title: String,
        val description: String,
        val params: ExerciseParams,
        val mediaId: String?,
        val videoUrl: String?,
        val isAllComplete: Boolean,
        /** Whether this exercise has been completed for the current session round. */
        val isCompleteForCurrentOccurrence: Boolean,
        val completedCount: Int,
        val totalCount: Int,
        /** Session-level current round: first occurrence where not all exercises are done. */
        val currentOccurrence: Int,
        val exerciseVersionId: String,
        val sessionKey: String,
        val assignmentKey: String
    ) : ExerciseDetailUiState()
    data class Error(val message: String) : ExerciseDetailUiState()
}

@HiltViewModel
class ExerciseDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val apiService: ApiService,
    private val dao: PendingCompletionDao,
    private val connectivityObserver: ConnectivityObserver,
    private val workManager: WorkManager
) : ViewModel() {

    private val assignmentKey: String = savedStateHandle.get<String>("assignmentKey") ?: ""
    private val sessionKey: String = savedStateHandle.get<String>("sessionKey") ?: ""

    private val _uiState = MutableStateFlow<ExerciseDetailUiState>(ExerciseDetailUiState.Loading)
    val uiState: StateFlow<ExerciseDetailUiState> = _uiState.asStateFlow()

    val isOnline: StateFlow<Boolean> = connectivityObserver.isOnline

    init {
        loadDetail()
    }

    private fun loadDetail() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
                val todayData = apiService.getToday(dateLocal)

                val assignment = todayData.assignments.find { it.assignmentKey == assignmentKey }

                if (assignment == null) {
                    _uiState.value = ExerciseDetailUiState.Error("Exercise not found")
                    return@launch
                }

                updateUiFromAssignment(assignment, todayData.timesPerDay, todayData.assignments)

                // Fetch video URL in the background after showing the exercise
                val mediaId = assignment.exercise.mediaId
                if (mediaId != null) {
                    try {
                        val videoAccess = apiService.getVideoAccess(mediaId)
                        val current = _uiState.value
                        if (current is ExerciseDetailUiState.Success) {
                            _uiState.value = current.copy(videoUrl = videoAccess.accessUrl)
                        }
                    } catch (_: Exception) {
                        // Video URL failure is non-fatal — exercise still usable
                    }
                }
            } catch (e: Exception) {
                _uiState.value = ExerciseDetailUiState.Error(
                    e.message ?: "Failed to load exercise"
                )
            }
        }
    }

    /**
     * Toggle complete/incomplete for the current session occurrence.
     * Matches iOS behavior: button works in both directions for the active round.
     */
    fun toggleComplete() {
        val currentState = _uiState.value
        if (currentState !is ExerciseDetailUiState.Success) return

        if (currentState.isCompleteForCurrentOccurrence) {
            markIncomplete(currentState)
        } else {
            markComplete(currentState)
        }
    }

    private fun markComplete(currentState: ExerciseDetailUiState.Success) {
        val occurrence = currentState.currentOccurrence
        val newCompletedCount = currentState.completedCount + 1

        _uiState.value = currentState.copy(
            isCompleteForCurrentOccurrence = true,
            completedCount = newCompletedCount,
            isAllComplete = newCompletedCount >= currentState.totalCount
        )

        val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val idempotencyKey = UUID.randomUUID().toString()

        viewModelScope.launch(Dispatchers.IO) {
            if (connectivityObserver.isCurrentlyOnline()) {
                try {
                    apiService.postCompletion(
                        idempotencyKey = idempotencyKey,
                        body = CompletionRequest(
                            dateLocal = dateLocal,
                            occurrence = occurrence,
                            exerciseVersionId = currentState.exerciseVersionId,
                            source = "android"
                        )
                    )
                } catch (_: Exception) {
                    _uiState.value = currentState // revert on failure
                }
            } else {
                dao.insert(
                    PendingCompletionEntity(
                        id = UUID.randomUUID().toString(),
                        dateLocal = dateLocal,
                        occurrence = occurrence,
                        exerciseVersionId = currentState.exerciseVersionId,
                        idempotencyKey = idempotencyKey,
                        source = "android",
                        createdAt = System.currentTimeMillis()
                    )
                )
                workManager.enqueue(CompletionSyncWorker.buildRequest())
            }
        }
    }

    private fun markIncomplete(currentState: ExerciseDetailUiState.Success) {
        val occurrence = currentState.currentOccurrence
        val newCompletedCount = (currentState.completedCount - 1).coerceAtLeast(0)

        _uiState.value = currentState.copy(
            isCompleteForCurrentOccurrence = false,
            completedCount = newCompletedCount,
            isAllComplete = false
        )

        val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        viewModelScope.launch(Dispatchers.IO) {
            if (connectivityObserver.isCurrentlyOnline()) {
                try {
                    apiService.deleteCompletion(
                        UncompletionRequest(
                            dateLocal = dateLocal,
                            occurrence = occurrence,
                            exerciseVersionId = currentState.exerciseVersionId
                        )
                    )
                } catch (_: Exception) {
                    _uiState.value = currentState // revert on failure
                }
            }
        }
    }

    private fun updateUiFromAssignment(
        assignment: TodayAssignment,
        timesPerDay: Int,
        allAssignments: List<TodayAssignment>
    ) {
        val params = assignment.effectiveParams ?: ExerciseParams(null, null, null)
        val completedOccurrences = assignment.completions.filter { it.completed }.map { it.occurrence }.toSet()

        // Session-level current occurrence: first round where not all exercises are done
        val currentSessionOccurrence = computeCurrentOccurrence(allAssignments, timesPerDay)
        val isCompleteForCurrentOccurrence = completedOccurrences.contains(currentSessionOccurrence)

        _uiState.value = ExerciseDetailUiState.Success(
            title = assignment.exercise.title,
            description = assignment.exercise.description,
            params = params,
            mediaId = assignment.exercise.mediaId,
            videoUrl = null, // fetched asynchronously after this
            isAllComplete = completedOccurrences.size >= timesPerDay,
            isCompleteForCurrentOccurrence = isCompleteForCurrentOccurrence,
            completedCount = completedOccurrences.size,
            totalCount = timesPerDay,
            currentOccurrence = currentSessionOccurrence,
            exerciseVersionId = assignment.exerciseVersionId,
            sessionKey = sessionKey,
            assignmentKey = assignment.assignmentKey
        )
    }

    /**
     * Session-level current occurrence: the first round where not all exercises have completed it.
     */
    private fun computeCurrentOccurrence(allAssignments: List<TodayAssignment>, timesPerDay: Int): Int {
        for (round in 1..timesPerDay) {
            val allDone = allAssignments.all { a ->
                a.completions.any { it.occurrence == round && it.completed }
            }
            if (!allDone) return round
        }
        return timesPerDay
    }
}
