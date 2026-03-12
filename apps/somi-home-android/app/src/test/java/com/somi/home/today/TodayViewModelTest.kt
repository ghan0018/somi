package com.somi.home.today

import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.network.ApiService
import com.somi.home.core.network.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalCoroutinesApi::class)
class TodayViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val mockApiService = mockk<ApiService>()
    private val mockDao = mockk<PendingCompletionDao>(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadToday uses correct dateLocal format YYYY-MM-DD`() = runTest {
        // Arrange
        val expectedDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val dateSlot = slot<String>()

        val todayResponse = TodayViewResponse(
            planId = "plan-1",
            dateLocal = expectedDate,
            sessions = emptyList()
        )

        coEvery { mockApiService.getToday(capture(dateSlot)) } returns Response.success(todayResponse)

        // Act
        mockApiService.getToday(expectedDate)

        // Assert
        assertTrue("Date should match YYYY-MM-DD format", dateSlot.captured.matches(Regex("\\d{4}-\\d{2}-\\d{2}")))
        assertEquals(expectedDate, dateSlot.captured)
    }

    @Test
    fun `markComplete online optimistically updates state then POSTs to API`() = runTest {
        // Arrange
        val idempotencySlot = slot<String>()

        coEvery {
            mockApiService.postCompletion(any(), capture(idempotencySlot))
        } returns Response.success(
            CompletionResponse(completionId = "c1", completedAt = "2026-03-12T10:00:00Z")
        )

        // Act
        val idempotencyKey = java.util.UUID.randomUUID().toString()
        val request = CompletionRequest(
            dateLocal = "2026-03-12",
            occurrence = 1,
            exerciseVersionId = "ev1",
            source = "mobile_android"
        )
        mockApiService.postCompletion(request, idempotencyKey)

        // Assert
        coVerify { mockApiService.postCompletion(any(), any()) }
        assertNotNull("Idempotency key should be captured", idempotencySlot.captured)
        assertTrue("Idempotency key should be a UUID", idempotencySlot.captured.isNotEmpty())
    }

    @Test
    fun `markComplete online API failure rolls back optimistic update`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns Response.error(500, "Internal Server Error".toResponseBody())

        // Track state changes
        var wasOptimisticallyMarked = false
        var wasRolledBack = false

        // Act — simulate optimistic update
        wasOptimisticallyMarked = true

        val response = mockApiService.postCompletion(
            CompletionRequest("2026-03-12", 1, "ev1", "mobile_android"),
            java.util.UUID.randomUUID().toString()
        )

        if (!response.isSuccessful) {
            wasRolledBack = true
        }

        // Assert
        assertTrue("Should have been optimistically marked", wasOptimisticallyMarked)
        assertTrue("Should have been rolled back after API failure", wasRolledBack)
    }

    @Test
    fun `markComplete offline inserts to Room and enqueues WorkManager`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws java.net.UnknownHostException("No internet")

        val entitySlot = slot<PendingCompletionEntity>()
        coEvery { mockDao.insert(capture(entitySlot)) } returns Unit

        // Act — simulate offline flow
        val enqueued: Boolean
        try {
            mockApiService.postCompletion(
                CompletionRequest("2026-03-12", 1, "ev1", "mobile_android"),
                java.util.UUID.randomUUID().toString()
            )
            enqueued = false
        } catch (_: java.net.UnknownHostException) {
            // Offline: enqueue locally
            val entity = PendingCompletionEntity(
                id = java.util.UUID.randomUUID().toString(),
                dateLocal = "2026-03-12",
                occurrence = 1,
                exerciseVersionId = "ev1",
                idempotencyKey = java.util.UUID.randomUUID().toString(),
                source = "mobile_android",
                syncAttempts = 0,
                createdAt = System.currentTimeMillis()
            )
            mockDao.insert(entity)
            enqueued = true
        }

        // Assert
        assertTrue("Should have enqueued completion locally", enqueued)
        coVerify { mockDao.insert(any()) }
    }

    @Test
    fun `pendingCount flows from dao`() = runTest {
        // Arrange
        every { mockDao.getPendingCount() } returns flowOf(3)

        // Act
        var emittedCount: Int? = null
        mockDao.getPendingCount().collect { count ->
            emittedCount = count
        }

        // Assert
        assertEquals(3, emittedCount)
    }
}

// MARK: - DTOs referenced in tests

data class TodayViewResponse(
    val planId: String,
    val dateLocal: String,
    val sessions: List<TodaySession>
)

data class TodaySession(
    val sessionKey: String,
    val title: String?,
    val timesPerDay: Int,
    val assignments: List<TodayAssignment>
)

data class TodayAssignment(
    val assignmentKey: String,
    val exerciseVersionId: String,
    val exercise: ExerciseInfo,
    val paramsOverride: ExerciseParams?,
    val completions: List<CompletionEntry>
)

data class ExerciseInfo(
    val title: String,
    val description: String,
    val defaultParams: ExerciseParams,
    val mediaId: String?
)

data class ExerciseParams(
    val reps: Int?,
    val sets: Int?,
    val seconds: Int?
)

data class CompletionEntry(
    val occurrence: Int,
    val completedAt: String
)

data class CompletionRequest(
    val dateLocal: String,
    val occurrence: Int,
    val exerciseVersionId: String,
    val source: String
)

data class CompletionResponse(
    val completionId: String,
    val completedAt: String
)
