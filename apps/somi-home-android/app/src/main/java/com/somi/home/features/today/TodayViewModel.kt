package com.somi.home.features.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.models.CompletionEntry
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.TodaySession
import com.somi.home.core.models.TodayViewResponse
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
    data class Success(val data: TodayViewResponse, val errorMessage: String? = null) : TodayUiState()
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

        // Optimistic update
        val updatedData = applyOptimisticCompletion(
            currentState.data, sessionKey, assignmentKey, occurrence
        )
        _uiState.value = TodayUiState.Success(updatedData)

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
                    // Revert optimistic update
                    _uiState.value = TodayUiState.Success(
                        currentState.data,
                        errorMessage = "Failed to save completion. Please try again."
                    )
                }
            } else {
                // Offline: queue for later sync
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

    fun clearErrorMessage() {
        val currentState = _uiState.value
        if (currentState is TodayUiState.Success) {
            _uiState.value = currentState.copy(errorMessage = null)
        }
    }

    private fun applyOptimisticCompletion(
        data: TodayViewResponse,
        sessionKey: String,
        assignmentKey: String,
        occurrence: Int
    ): TodayViewResponse {
        val updatedSessions = data.sessions.map { session ->
            if (session.sessionKey == sessionKey) {
                session.copy(
                    assignments = session.assignments.map { assignment ->
                        if (assignment.assignmentKey == assignmentKey) {
                            assignment.copy(
                                completions = assignment.completions + CompletionEntry(
                                    occurrence = occurrence,
                                    completedAt = java.time.Instant.now().toString()
                                )
                            )
                        } else {
                            assignment
                        }
                    }
                )
            } else {
                session
            }
        }
        return data.copy(sessions = updatedSessions)
    }

    /**
     * Returns the next incomplete occurrence number for an assignment,
     * or null if all occurrences are complete.
     */
    fun nextOccurrence(assignment: TodayAssignment, timesPerDay: Int): Int? {
        val completedOccurrences = assignment.completions.map { it.occurrence }.toSet()
        return (1..timesPerDay).firstOrNull { it !in completedOccurrences }
    }

    /**
     * Find an assignment by key across all sessions.
     */
    fun findAssignment(sessionKey: String, assignmentKey: String): Pair<TodaySession, TodayAssignment>? {
        val currentState = _uiState.value
        if (currentState !is TodayUiState.Success) return null
        val session = currentState.data.sessions.find { it.sessionKey == sessionKey } ?: return null
        val assignment = session.assignments.find { it.assignmentKey == assignmentKey } ?: return null
        return session to assignment
    }
}
