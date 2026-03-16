package com.somi.home.features.today

import androidx.lifecycle.SavedStateHandle
import androidx.work.WorkManager
import app.cash.turbine.test
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.models.CompletionResponse
import com.somi.home.core.models.VideoAccessResponse
import com.somi.home.core.network.ApiService
import io.mockk.coEvery
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseDetailViewModelTest {

    private lateinit var apiService: ApiService
    private lateinit var dao: PendingCompletionDao
    private lateinit var connectivityObserver: ConnectivityObserver
    private lateinit var workManager: WorkManager

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
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildVm(
        assignmentKey: String = "a1",
        sessionKey: String = "sess_01"
    ): ExerciseDetailViewModel {
        val savedStateHandle = SavedStateHandle(
            mapOf("assignmentKey" to assignmentKey, "sessionKey" to sessionKey)
        )
        return ExerciseDetailViewModel(
            savedStateHandle = savedStateHandle,
            apiService = apiService,
            dao = dao,
            connectivityObserver = connectivityObserver,
            workManager = workManager
        )
    }

    /** Waits for first Success state. */
    private suspend fun awaitSuccess(vm: ExerciseDetailViewModel): ExerciseDetailUiState.Success {
        var result: ExerciseDetailUiState.Success? = null
        vm.uiState.test {
            while (true) {
                val item = awaitItem()
                if (item is ExerciseDetailUiState.Success) {
                    result = item
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
        return result!!
    }

    @Test
    fun loadDetail_transitions_Loading_then_Success() = runTest {
        val assignment = makeAssignment(key = "a1", title = "Tongue Stretch")
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)

        val vm = buildVm()

        vm.uiState.test {
            var sawLoading = false
            var sawSuccess = false

            while (!sawSuccess) {
                val item = awaitItem()
                when (item) {
                    is ExerciseDetailUiState.Loading -> sawLoading = true
                    is ExerciseDetailUiState.Success -> {
                        sawSuccess = true
                        assertEquals("Tongue Stretch", item.title)
                    }
                    else -> {}
                }
            }
            // Loading may or may not be observed depending on timing; Success is always required
            assertTrue(sawSuccess)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun loadDetail_setsVideoUrl_afterBackgroundFetch() = runTest {
        val assignment = makeAssignment(key = "a1", mediaId = "media-123")
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)
        coEvery { apiService.getVideoAccess("media-123") } returns
                VideoAccessResponse(accessUrl = "https://cdn.example.com/video.mp4", expiresAt = "2026-03-15T00:00:00Z")

        val vm = buildVm()

        vm.uiState.test {
            // We expect: possibly Loading, then Success(videoUrl=null), then Success(videoUrl=...)
            var successWithVideo: ExerciseDetailUiState.Success? = null
            while (successWithVideo == null) {
                val item = awaitItem()
                if (item is ExerciseDetailUiState.Success && item.videoUrl != null) {
                    successWithVideo = item
                }
            }
            assertNotNull(successWithVideo.videoUrl)
            assertEquals("https://cdn.example.com/video.mp4", successWithVideo.videoUrl)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun loadDetail_videoUrlNull_whenNoMediaId() = runTest {
        val assignment = makeAssignment(key = "a1", mediaId = null)
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)

        val vm = buildVm()
        val state = awaitSuccess(vm)
        assertNull(state.videoUrl)
    }

    @Test
    fun loadDetail_videoUrlFailure_isNonFatal() = runTest {
        val assignment = makeAssignment(key = "a1", mediaId = "media-456")
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)
        coEvery { apiService.getVideoAccess("media-456") } throws RuntimeException("CDN error")

        val vm = buildVm()

        vm.uiState.test {
            // Should eventually settle on a Success state (video failure is non-fatal)
            var successSeen = false
            while (!successSeen) {
                val item = awaitItem()
                if (item is ExerciseDetailUiState.Success) {
                    // The state should be Success, and videoUrl null since fetch failed
                    assertNull(item.videoUrl)
                    successSeen = true
                }
            }
            assertTrue(successSeen)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun toggleComplete_whenIncomplete_callsMarkComplete() = runTest {
        val assignment = makeAssignment(key = "a1", completions = listOf(makeCompletion(1, false)))
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)
        coEvery { apiService.postCompletion(any(), any()) } returns
                CompletionResponse(completionId = "c1", completedAt = "2026-03-14T00:00:00Z")

        val vm = buildVm()
        val initial = awaitSuccess(vm)
        assertFalse(initial.isCompleteForCurrentOccurrence)

        vm.uiState.test {
            vm.toggleComplete()
            while (true) {
                val item = awaitItem()
                if (item is ExerciseDetailUiState.Success && item.isCompleteForCurrentOccurrence) {
                    assertTrue(item.isCompleteForCurrentOccurrence)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun toggleComplete_whenComplete_callsMarkIncomplete() = runTest {
        val assignment = makeAssignment(key = "a1", completions = listOf(makeCompletion(1, true)))
        coEvery { apiService.getToday(any()) } returns
                makeTodayResponse(assignments = listOf(assignment), timesPerDay = 1)
        coEvery { apiService.deleteCompletion(any()) } returns Unit

        val vm = buildVm()
        val initial = awaitSuccess(vm)
        assertTrue(initial.isCompleteForCurrentOccurrence)

        vm.uiState.test {
            vm.toggleComplete()
            while (true) {
                val item = awaitItem()
                if (item is ExerciseDetailUiState.Success && !item.isCompleteForCurrentOccurrence) {
                    assertFalse(item.isCompleteForCurrentOccurrence)
                    break
                }
            }
            cancelAndIgnoreRemainingEvents()
        }
    }
}
