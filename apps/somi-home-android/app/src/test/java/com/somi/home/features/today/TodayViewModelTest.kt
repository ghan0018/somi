package com.somi.home.features.today

import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import app.cash.turbine.test
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.models.CompletionEntry
import com.somi.home.core.models.CompletionResponse
import com.somi.home.core.models.ExerciseInfo
import com.somi.home.core.models.ExerciseParams
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.TodayViewResponse
import com.somi.home.core.network.ApiService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

fun makeCompletion(occurrence: Int, completed: Boolean) = CompletionEntry(
    occurrence = occurrence,
    completed = completed,
    completedAt = if (completed) "2026-03-14T00:00:00Z" else null
)

fun makeAssignment(
    key: String = "a1",
    exerciseVersionId: String = "ev1",
    title: String = "Test Exercise",
    mediaId: String? = null,
    completions: List<CompletionEntry> = listOf(makeCompletion(1, false))
) = TodayAssignment(
    assignmentKey = key,
    exerciseVersionId = exerciseVersionId,
    exercise = ExerciseInfo(
        title = title,
        description = "desc",
        defaultParams = null,
        mediaId = mediaId
    ),
    effectiveParams = ExerciseParams(sets = 3, reps = 10, seconds = null),
    completions = completions
)

fun makeTodayResponse(
    assignments: List<TodayAssignment>,
    timesPerDay: Int = 1,
    sessionKey: String = "sess_01"
) = TodayViewResponse(
    dateLocal = "2026-03-14",
    sessionKey = sessionKey,
    sessionTitle = "Week 1",
    timesPerDay = timesPerDay,
    assignments = assignments,
    sessionNotes = null,
    overallCompletionRate = 0.0
)

// ---------------------------------------------------------------------------
// TodayViewModelTest
// ---------------------------------------------------------------------------

@OptIn(ExperimentalCoroutinesApi::class)
class TodayViewModelTest {

    private lateinit var apiService: ApiService
    private lateinit var dao: PendingCompletionDao
    private lateinit var connectivityObserver: ConnectivityObserver
    private lateinit var workManager: WorkManager

    private val defaultResponse = makeTodayResponse(
        assignments = listOf(makeAssignment()),
        timesPerDay = 1
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        apiService = mockk()
        dao = mockk(relaxed = true)
        connectivityObserver = mockk()
        workManager = mockk(relaxed = true)

        every { dao.getPendingCount() } returns flowOf(0)
        every { connectivityObserver.isOnline } returns MutableStateFlow(true)
        every { connectivityObserver.isCurrentlyOnline() } returns true
        coEvery { apiService.getToday(any()) } returns defaultResponse
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildVm() = TodayViewModel(apiService, dao, connectivityObserver, workManager)

    /** Waits for the first Success state from the VM's uiState. */
    private suspend fun awaitSuccess(vm: TodayViewModel): TodayUiState.Success {
        var result: TodayUiState.Success? = null
        vm.uiState.test {
            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success) {
                    result = item
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
        return result!!
    }

    // -----------------------------------------------------------------------
    // Pure logic tests (no coroutines needed)
    // -----------------------------------------------------------------------

    @Test
    fun currentOccurrence_returnsOne_whenNothingDone() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(makeAssignment(completions = listOf(makeCompletion(1, false)))),
            timesPerDay = 2
        )
        assertEquals(1, vm.currentOccurrence(data))
    }

    @Test
    fun currentOccurrence_advancesToTwo_whenRoundOneComplete() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(
                makeAssignment(completions = listOf(makeCompletion(1, true), makeCompletion(2, false)))
            ),
            timesPerDay = 2
        )
        assertEquals(2, vm.currentOccurrence(data))
    }

    @Test
    fun currentOccurrence_staysAtOne_whenPartialRound() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(
                makeAssignment(key = "a1", completions = listOf(makeCompletion(1, true))),
                makeAssignment(key = "a2", completions = listOf(makeCompletion(1, false)))
            ),
            timesPerDay = 2
        )
        assertEquals(1, vm.currentOccurrence(data))
    }

    @Test
    fun currentOccurrence_returnsTimesPerDay_whenAllDone() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(
                makeAssignment(completions = listOf(makeCompletion(1, true), makeCompletion(2, true)))
            ),
            timesPerDay = 2
        )
        assertEquals(2, vm.currentOccurrence(data))
    }

    @Test
    fun isAllDoneForDay_false_whenEmpty() {
        val vm = buildVm()
        val data = makeTodayResponse(assignments = emptyList(), timesPerDay = 1)
        assertFalse(vm.isAllDoneForDay(data))
    }

    @Test
    fun isAllDoneForDay_false_whenPartial() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(makeAssignment(completions = listOf(makeCompletion(1, false)))),
            timesPerDay = 1
        )
        assertFalse(vm.isAllDoneForDay(data))
    }

    @Test
    fun isAllDoneForDay_true_whenAllRoundsComplete() {
        val vm = buildVm()
        val data = makeTodayResponse(
            assignments = listOf(makeAssignment(completions = listOf(makeCompletion(1, true)))),
            timesPerDay = 1
        )
        assertTrue(vm.isAllDoneForDay(data))
    }

    // -----------------------------------------------------------------------
    // Coroutine / StateFlow tests
    // -----------------------------------------------------------------------

    @Test
    fun markComplete_optimisticUpdate_setsCompletedImmediately() = runTest {
        coEvery { apiService.postCompletion(any(), any()) } returns
                CompletionResponse(completionId = "c1", completedAt = "2026-03-14T00:00:00Z")

        val vm = buildVm()

        // Wait for initial load to complete
        val initial = awaitSuccess(vm)
        assertFalse(initial.data.assignments.first().completions.first { it.occurrence == 1 }.completed)

        vm.uiState.test {
            vm.markComplete(sessionKey = "sess_01", assignmentKey = "a1", exerciseVersionId = "ev1", occurrence = 1)

            // Find the first Success with the assignment completed
            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success) {
                    val assignment = item.data.assignments.find { it.assignmentKey == "a1" }
                    val completion = assignment?.completions?.find { it.occurrence == 1 }
                    if (completion?.completed == true) {
                        assertTrue(completion.completed)
                        break
                    }
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun markComplete_showsCongratsModal_whenRoundCompletes_butMoreRemain() = runTest {
        val assignments = listOf(
            makeAssignment(key = "a1", completions = listOf(makeCompletion(1, true), makeCompletion(2, false))),
            makeAssignment(key = "a2", completions = listOf(makeCompletion(1, false), makeCompletion(2, false)))
        )
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = assignments, timesPerDay = 2)
        coEvery { apiService.postCompletion(any(), any()) } returns
                CompletionResponse(completionId = "c1", completedAt = "2026-03-14T00:00:00Z")

        val vm = buildVm()
        awaitSuccess(vm)

        vm.uiState.test {
            vm.markComplete(sessionKey = "sess_01", assignmentKey = "a2", exerciseVersionId = "ev1", occurrence = 1)

            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success && item.showCongratsModal) {
                    assertTrue(item.showCongratsModal)
                    assertEquals(1, item.completedRoundsForModal)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun markComplete_doesNotShowCongratsModal_whenFinalRoundCompletes() = runTest {
        val assignments = listOf(makeAssignment(key = "a1", completions = listOf(makeCompletion(1, false))))
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = assignments, timesPerDay = 1)
        coEvery { apiService.postCompletion(any(), any()) } returns
                CompletionResponse(completionId = "c1", completedAt = "2026-03-14T00:00:00Z")

        val vm = buildVm()
        awaitSuccess(vm)

        vm.uiState.test {
            vm.markComplete(sessionKey = "sess_01", assignmentKey = "a1", exerciseVersionId = "ev1", occurrence = 1)

            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success) {
                    val completion = item.data.assignments.first().completions.first { it.occurrence == 1 }
                    if (completion.completed) {
                        assertFalse(item.showCongratsModal)
                        assertTrue(vm.isAllDoneForDay(item.data))
                        break
                    }
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun markComplete_setsErrorMessage_onApiFailure() = runTest {
        coEvery { apiService.postCompletion(any(), any()) } throws RuntimeException("Network error")

        val vm = buildVm()
        awaitSuccess(vm)

        vm.uiState.test {
            vm.markComplete(sessionKey = "sess_01", assignmentKey = "a1", exerciseVersionId = "ev1", occurrence = 1)

            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success && item.errorMessage != null) {
                    assertNotNull(item.errorMessage)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun markComplete_offline_insertsToDao_enqueuesWork() = runTest {
        every { connectivityObserver.isCurrentlyOnline() } returns false

        val vm = buildVm()
        awaitSuccess(vm)

        vm.uiState.test {
            vm.markComplete(sessionKey = "sess_01", assignmentKey = "a1", exerciseVersionId = "ev1", occurrence = 1)

            // The optimistic update emits a new state immediately
            val item = awaitItem()
            assertTrue(item is TodayUiState.Success)
            cancelAndIgnoreRemainingEvents()
        }

        coVerify { dao.insert(any()) }
        coVerify { workManager.enqueue(any<OneTimeWorkRequest>()) }
    }

    @Test
    fun markIncomplete_optimisticUpdate_setsUncompleted() = runTest {
        val assignments = listOf(makeAssignment(completions = listOf(makeCompletion(1, true))))
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = assignments, timesPerDay = 1)
        coEvery { apiService.deleteCompletion(any()) } returns Unit

        val vm = buildVm()
        awaitSuccess(vm)

        vm.uiState.test {
            vm.markIncomplete(sessionKey = "sess_01", assignmentKey = "a1", exerciseVersionId = "ev1", occurrence = 1)

            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success) {
                    val completion = item.data.assignments.find { it.assignmentKey == "a1" }!!
                        .completions.find { it.occurrence == 1 }
                    if (completion?.completed == false) {
                        assertFalse(completion.completed)
                        break
                    }
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun dismissCongratsModal_clearsModalState() = runTest {
        val assignments = listOf(
            makeAssignment(key = "a1", completions = listOf(makeCompletion(1, true), makeCompletion(2, false))),
            makeAssignment(key = "a2", completions = listOf(makeCompletion(1, false), makeCompletion(2, false)))
        )
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = assignments, timesPerDay = 2)
        coEvery { apiService.postCompletion(any(), any()) } returns
                CompletionResponse(completionId = "c1", completedAt = "2026-03-14T00:00:00Z")

        val vm = buildVm()
        awaitSuccess(vm)
        vm.markComplete(sessionKey = "sess_01", assignmentKey = "a2", exerciseVersionId = "ev1", occurrence = 1)

        vm.uiState.test {
            // Wait for congrats modal state
            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Success && item.showCongratsModal) {
                    assertTrue(item.showCongratsModal)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }

        vm.dismissCongratsModal()

        val stateAfter = vm.uiState.value as TodayUiState.Success
        assertFalse(stateAfter.showCongratsModal)
        assertEquals(0, stateAfter.completedRoundsForModal)
    }

    @Test
    fun loadToday_setsSuccessState_onApiSuccess() = runTest {
        val response = makeTodayResponse(assignments = listOf(makeAssignment(title = "Push Up")))
        coEvery { apiService.getToday(any()) } returns response

        val vm = buildVm()
        val state = awaitSuccess(vm)

        assertEquals("sess_01", state.data.sessionKey)
        assertEquals("Push Up", state.data.assignments.first().exercise.title)
    }

    @Test
    fun loadToday_setsErrorState_onApiFailure() = runTest {
        coEvery { apiService.getToday(any()) } throws RuntimeException("Server error")

        val vm = buildVm()

        vm.uiState.test {
            while (true) {
                val item = awaitItem()
                if (item is TodayUiState.Error) {
                    assertNotNull(item.message)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }
}
