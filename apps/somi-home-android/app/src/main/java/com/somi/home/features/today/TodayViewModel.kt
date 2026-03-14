package com.somi.home.features.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.TodayViewResponse
import com.somi.home.core.models.UncompletionRequest
import com.somi.home.core.network.ApiService
import com.somi.home.core.sync.CompletionSyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject

sealed class TodayUiState {
    data object Loading : TodayUiState()
    data class Success(
        val data: TodayViewResponse,
        val errorMessage: String? = null,
        val showCongratsModal: Boolean = false,
        val completedRoundsForModal: Int = 0
    ) : TodayUiState()
    data class Error(val message: String) : TodayUiState()
}

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val apiService: ApiService,
    private val dao: PendingCompletionDao,
    private val connectivityObserver: ConnectivityObserver,
    private val workManager: WorkManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState.asStateFlow()

    val pendingCount: StateFlow<Int> = dao.getPendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    init {
        loadToday()
    }

    fun loadToday() {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = TodayUiState.Loading
            try {
                val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
                val response = apiService.getToday(dateLocal)
                _uiState.value = TodayUiState.Success(response)
            } catch (e: Exception) {
                _uiState.value = TodayUiState.Error(
                    e.message ?: "Failed to load today's exercises"
                )
            }
        }
    }

    fun markComplete(
        sessionKey: String,
        assignmentKey: String,
        exerciseVersionId: String,
        occurrence: Int
    ) {
        val currentState = _uiState.value
        if (currentState !is TodayUiState.Success) return

        val prevRounds = completedRoundsCount(currentState.data)

        // Optimistic update
        val updatedData = applyOptimisticCompletion(
            currentState.data, sessionKey, assignmentKey, occurrence
        )

        val newRounds = completedRoundsCount(updatedData)
        // Show congrats modal when a round completes but more rounds remain
        val showModal = newRounds > prevRounds && newRounds < updatedData.timesPerDay

        _uiState.value = TodayUiState.Success(
            data = updatedData,
            showCongratsModal = showModal,
            completedRoundsForModal = if (showModal) newRounds else 0
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
                            exerciseVersionId = exerciseVersionId,
                            source = "android"
                        )
                    )
                } catch (e: Exception) {
                    _uiState.value = TodayUiState.Success(
                        currentState.data,
                        errorMessage = "Failed to save completion. Please try again."
                    )
                }
            } else {
                dao.insert(
                    PendingCompletionEntity(
                        id = UUID.randomUUID().toString(),
                        dateLocal = dateLocal,
                        occurrence = occurrence,
                        exerciseVersionId = exerciseVersionId,
                        idempotencyKey = idempotencyKey,
                        source = "android",
                        createdAt = System.currentTimeMillis()
                    )
                )
                workManager.enqueue(CompletionSyncWorker.buildRequest())
            }
        }
    }

    fun markIncomplete(
        sessionKey: String,
        assignmentKey: String,
        exerciseVersionId: String,
        occurrence: Int
    ) {
        val currentState = _uiState.value
        if (currentState !is TodayUiState.Success) return

        // Optimistic update
        val updatedData = applyOptimisticUncomplete(
            currentState.data, sessionKey, assignmentKey, occurrence
        )
        _uiState.value = TodayUiState.Success(updatedData)

        val dateLocal = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        viewModelScope.launch(Dispatchers.IO) {
            if (connectivityObserver.isCurrentlyOnline()) {
                try {
                    apiService.deleteCompletion(
                        UncompletionRequest(
                            dateLocal = dateLocal,
                            occurrence = occurrence,
                            exerciseVersionId = exerciseVersionId
                        )
                    )
                } catch (e: Exception) {
                    _uiState.value = TodayUiState.Success(
                        currentState.data,
                        errorMessage = "Failed to undo completion."
                    )
                }
            }
        }
    }

    fun dismissCongratsModal() {
        val state = _uiState.value as? TodayUiState.Success ?: return
        _uiState.value = state.copy(showCongratsModal = false, completedRoundsForModal = 0)
    }

    fun clearErrorMessage() {
        val currentState = _uiState.value
        if (currentState is TodayUiState.Success) {
            _uiState.value = currentState.copy(errorMessage = null)
        }
    }

    /**
     * The active session round: the first occurrence where not all exercises are done.
     * This is the occurrence that all exercises should be working toward.
     */
    fun currentOccurrence(data: TodayViewResponse): Int {
        for (round in 1..data.timesPerDay) {
            val allDone = data.assignments.all { a ->
                a.completions.any { it.occurrence == round && it.completed }
            }
            if (!allDone) return round
        }
        return data.timesPerDay
    }

    /**
     * True when every occurrence of every exercise is marked complete.
     */
    fun isAllDoneForDay(data: TodayViewResponse): Boolean {
        if (data.assignments.isEmpty()) return false
        return completedRoundsCount(data) >= data.timesPerDay
    }

    private fun completedRoundsCount(data: TodayViewResponse): Int {
        var count = 0
        for (round in 1..data.timesPerDay) {
            val allDone = data.assignments.all { a ->
                a.completions.any { it.occurrence == round && it.completed }
            }
            if (allDone) count++
        }
        return count
    }

    private fun applyOptimisticCompletion(
        data: TodayViewResponse,
        sessionKey: String,
        assignmentKey: String,
        occurrence: Int
    ): TodayViewResponse {
        if (data.sessionKey != sessionKey) return data
        val updatedAssignments = data.assignments.map { assignment ->
            if (assignment.assignmentKey == assignmentKey) {
                assignment.copy(
                    completions = assignment.completions.map { entry ->
                        if (entry.occurrence == occurrence) entry.copy(
                            completed = true,
                            completedAt = java.time.Instant.now().toString()
                        )
                        else entry
                    }
                )
            } else {
                assignment
            }
        }
        return data.copy(assignments = updatedAssignments)
    }

    private fun applyOptimisticUncomplete(
        data: TodayViewResponse,
        sessionKey: String,
        assignmentKey: String,
        occurrence: Int
    ): TodayViewResponse {
        if (data.sessionKey != sessionKey) return data
        val updatedAssignments = data.assignments.map { assignment ->
            if (assignment.assignmentKey == assignmentKey) {
                assignment.copy(
                    completions = assignment.completions.map { entry ->
                        if (entry.occurrence == occurrence) entry.copy(completed = false, completedAt = null)
                        else entry
                    }
                )
            } else {
                assignment
            }
        }
        return data.copy(assignments = updatedAssignments)
    }

    /**
     * Find an assignment by key in the current session.
     */
    fun findAssignment(assignmentKey: String): TodayAssignment? {
        val currentState = _uiState.value
        if (currentState !is TodayUiState.Success) return null
        return currentState.data.assignments.find { it.assignmentKey == assignmentKey }
    }
}
