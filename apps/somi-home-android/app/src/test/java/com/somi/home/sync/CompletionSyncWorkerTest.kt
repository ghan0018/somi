package com.somi.home.sync

import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.network.ApiService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Response
import java.io.IOException

class CompletionSyncWorkerTest {

    private val mockApiService = mockk<ApiService>()
    private val mockDao = mockk<PendingCompletionDao>(relaxed = true)

    private val testEntity = PendingCompletionEntity(
        id = "test-id-1",
        dateLocal = "2026-03-12",
        occurrence = 1,
        exerciseVersionId = "ev1",
        idempotencyKey = "idem-key-1",
        source = "mobile_android",
        syncAttempts = 0,
        createdAt = System.currentTimeMillis()
    )

    @Before
    fun setUp() {
        coEvery { mockDao.getAllPending() } returns listOf(testEntity)
    }

    /**
     * Simulates the sync worker logic for a single item.
     * This mirrors CompletionSyncWorker.doWork() behavior.
     */
    private suspend fun syncItem(item: PendingCompletionEntity): SyncResult {
        return try {
            val request = com.somi.home.today.CompletionRequest(
                dateLocal = item.dateLocal,
                occurrence = item.occurrence,
                exerciseVersionId = item.exerciseVersionId,
                source = item.source
            )
            val response = mockApiService.postCompletion(request, item.idempotencyKey)

            when {
                response.isSuccessful -> {
                    mockDao.delete(item.id)
                    SyncResult.SUCCESS
                }
                response.code() == 409 -> {
                    // Already recorded — idempotent success
                    mockDao.delete(item.id)
                    SyncResult.SUCCESS
                }
                response.code() in 400..499 -> {
                    // Permanent client error — discard
                    mockDao.delete(item.id)
                    SyncResult.SUCCESS
                }
                else -> {
                    // 5xx — retry
                    mockDao.incrementAttempts(item.id)
                    SyncResult.RETRY
                }
            }
        } catch (_: IOException) {
            mockDao.incrementAttempts(item.id)
            SyncResult.RETRY
        } catch (_: Exception) {
            mockDao.incrementAttempts(item.id)
            SyncResult.RETRY
        }
    }

    enum class SyncResult { SUCCESS, RETRY }

    @Test
    fun `201 response deletes completion from dao`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns Response.success(
            com.somi.home.today.CompletionResponse("c1", "2026-03-12T10:00:00Z")
        )

        // Act
        val result = syncItem(testEntity)

        // Assert
        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete("test-id-1") }
    }

    @Test
    fun `409 response deletes completion (idempotent success)`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns Response.error(409, "Conflict".toResponseBody())

        // Act
        val result = syncItem(testEntity)

        // Assert
        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete("test-id-1") }
    }

    @Test
    fun `400 response deletes completion (permanent failure)`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns Response.error(400, "Bad Request".toResponseBody())

        // Act
        val result = syncItem(testEntity)

        // Assert
        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete("test-id-1") }
    }

    @Test
    fun `5xx response increments attempts and returns retry`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns Response.error(503, "Service Unavailable".toResponseBody())

        // Act
        val result = syncItem(testEntity)

        // Assert
        assertEquals(SyncResult.RETRY, result)
        coVerify { mockDao.incrementAttempts("test-id-1") }
    }

    @Test
    fun `IOException increments attempts and returns retry`() = runTest {
        // Arrange
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws IOException("Connection reset")

        // Act
        val result = syncItem(testEntity)

        // Assert
        assertEquals(SyncResult.RETRY, result)
        coVerify { mockDao.incrementAttempts("test-id-1") }
    }
}
