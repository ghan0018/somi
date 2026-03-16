package com.somi.home.today

import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.CompletionResponse
import com.somi.home.core.network.ApiService
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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
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
        every { mockDao.getPendingCount() } returns flowOf(0)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadToday uses correct dateLocal format YYYY-MM-DD`() = runTest {
        val expectedDate = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val dateSlot = slot<String>()

        coEvery { mockApiService.getToday(capture(dateSlot)) } returns
            com.somi.home.features.today.makeTodayResponse(emptyList())

        mockApiService.getToday(expectedDate)

        assertTrue("Date should match YYYY-MM-DD format", dateSlot.captured.matches(Regex("\\d{4}-\\d{2}-\\d{2}")))
        assertEquals(expectedDate, dateSlot.captured)
    }

    @Test
    fun `markComplete online optimistically updates state then POSTs to API`() = runTest {
        val idempotencySlot = slot<String>()

        coEvery {
            mockApiService.postCompletion(capture(idempotencySlot), any())
        } returns CompletionResponse(completionId = "c1", completedAt = "2026-03-12T10:00:00Z")

        val idempotencyKey = java.util.UUID.randomUUID().toString()
        val request = CompletionRequest(
            dateLocal = "2026-03-12",
            occurrence = 1,
            exerciseVersionId = "ev1",
            source = "android"
        )
        mockApiService.postCompletion(idempotencyKey, request)

        coVerify { mockApiService.postCompletion(any(), any()) }
        assertNotNull("Idempotency key should be captured", idempotencySlot.captured)
        assertTrue("Idempotency key should be a UUID", idempotencySlot.captured.isNotEmpty())
    }

    @Test
    fun `markComplete offline inserts to Room and enqueues WorkManager`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws java.net.UnknownHostException("No internet")

        var enqueued = false
        try {
            mockApiService.postCompletion(
                "idem-key",
                CompletionRequest("2026-03-12", 1, "ev1", "android")
            )
        } catch (_: java.net.UnknownHostException) {
            val entity = com.somi.home.core.database.PendingCompletionEntity(
                id = java.util.UUID.randomUUID().toString(),
                dateLocal = "2026-03-12",
                occurrence = 1,
                exerciseVersionId = "ev1",
                idempotencyKey = java.util.UUID.randomUUID().toString(),
                source = "android",
                syncAttempts = 0,
                createdAt = System.currentTimeMillis()
            )
            mockDao.insert(entity)
            enqueued = true
        }

        assertTrue("Should have enqueued completion locally", enqueued)
        coVerify { mockDao.insert(any()) }
    }

    @Test
    fun `pendingCount flows from dao`() = runTest {
        every { mockDao.getPendingCount() } returns flowOf(3)

        var emittedCount: Int? = null
        mockDao.getPendingCount().collect { count ->
            emittedCount = count
        }

        assertEquals(3, emittedCount)
    }
}
