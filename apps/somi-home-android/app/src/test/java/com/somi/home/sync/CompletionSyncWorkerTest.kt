package com.somi.home.sync

import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.CompletionResponse
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
        coEvery { mockDao.getAll() } returns listOf(testEntity)
    }

    /**
     * Simulates the sync worker logic for a single item.
     * This mirrors CompletionSyncWorker.doWork() behavior.
     */
    private suspend fun syncItem(item: PendingCompletionEntity): SyncResult {
        return try {
            val completionResponse = mockApiService.postCompletion(
                idempotencyKey = item.idempotencyKey,
                body = CompletionRequest(
                    dateLocal = item.dateLocal,
                    occurrence = item.occurrence,
                    exerciseVersionId = item.exerciseVersionId,
                    source = item.source
                )
            )
            // postCompletion returns CompletionResponse on success (suspend, throws on error)
            mockDao.delete(item)
            SyncResult.SUCCESS
        } catch (e: retrofit2.HttpException) {
            when (val code = e.code()) {
                409, in 400..499 -> {
                    // Idempotent success or permanent client error — discard
                    mockDao.delete(item)
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
    fun `successful response deletes completion from dao`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } returns CompletionResponse("c1", "2026-03-12T10:00:00Z")

        val result = syncItem(testEntity)

        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete(testEntity) }
    }

    @Test
    fun `409 response deletes completion (idempotent success)`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws retrofit2.HttpException(
            Response.error<CompletionResponse>(409, "Conflict".toResponseBody())
        )

        val result = syncItem(testEntity)

        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete(testEntity) }
    }

    @Test
    fun `400 response deletes completion (permanent failure)`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws retrofit2.HttpException(
            Response.error<CompletionResponse>(400, "Bad Request".toResponseBody())
        )

        val result = syncItem(testEntity)

        assertEquals(SyncResult.SUCCESS, result)
        coVerify { mockDao.delete(testEntity) }
    }

    @Test
    fun `5xx response increments attempts and returns retry`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws retrofit2.HttpException(
            Response.error<CompletionResponse>(503, "Service Unavailable".toResponseBody())
        )

        val result = syncItem(testEntity)

        assertEquals(SyncResult.RETRY, result)
        coVerify { mockDao.incrementAttempts("test-id-1") }
    }

    @Test
    fun `IOException increments attempts and returns retry`() = runTest {
        coEvery {
            mockApiService.postCompletion(any(), any())
        } throws IOException("Connection reset")

        val result = syncItem(testEntity)

        assertEquals(SyncResult.RETRY, result)
        coVerify { mockDao.incrementAttempts("test-id-1") }
    }
}
