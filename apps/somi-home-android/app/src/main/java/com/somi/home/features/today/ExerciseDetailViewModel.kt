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
import com.somi.home.core.network.ApiService
import com.somi.home.core.sync.CompletionSyncWorker
import com.somi.home.ui.components.effectiveParams
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
        val isAllComplete: Boolean,
        val completedCount: Int,
        val totalCount: Int,
        val nextOccurrence: Int?,
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

                val session = todayData.sessions.find { it.sessionKey == sessionKey }
                val assignment = session?.assignments?.find { it.assignmentKey == assignmentKey }

                if (session == null || assignment == null) {
                    _uiState.value = ExerciseDetailUiState.Error("Exercise not found")
                    return@launch
                }

                updateUiFromAssignment(assignment, session.timesPerDay)
            } catch (e: Exception) {
                _uiState.value = ExerciseDetailUiState.Error(
                    e.message ?: "Failed to load exercise"
                )
            }
        }
    }

    fun markComplete() {
        val currentState = _uiState.value
        if (currentState !is ExerciseDetailUiState.Success) return
        val occurrence = currentState.nextOccurrence ?: return

        val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val idempotencyKey = UUID.randomUUID().toString()

        // Optimistic update
        val newCompletedCount = currentState.completedCount + 1
        val newNextOccurrence = if (newCompletedCount >= currentState.totalCount) null else occurrence + 1
        _uiState.value = currentState.copy(
            completedCount = newCompletedCount,
            isAllComplete = newCompletedCount >= currentState.totalCount,
            nextOccurrence = newNextOccurrence
        )

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
                    // Revert on failure
                    _uiState.value = currentState
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

    private fun updateUiFromAssignment(assignment: TodayAssignment, timesPerDay: Int) {
        val params = effectiveParams(assignment.exercise.defaultParams, assignment.paramsOverride)
        val completedOccurrences = assignment.completions.map { it.occurrence }.toSet()
        val nextOccurrence = (1..timesPerDay).firstOrNull { it !in completedOccurrences }

        _uiState.value = ExerciseDetailUiState.Success(
            title = assignment.exercise.title,
            description = assignment.exercise.description,
            params = params,
            mediaId = assignment.exercise.mediaId,
            isAllComplete = completedOccurrences.size >= timesPerDay,
            completedCount = completedOccurrences.size,
            totalCount = timesPerDay,
            nextOccurrence = nextOccurrence,
            exerciseVersionId = assignment.exerciseVersionId,
            sessionKey = sessionKey,
            assignmentKey = assignment.assignmentKey
        )
    }
}
