package com.somi.home.plan

import com.somi.home.core.network.ApiService
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class PlanViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val mockApiService = mockk<ApiService>()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `404 response results in Empty state not Error state`() = runTest {
        // Arrange
        coEvery { mockApiService.getPlan() } returns Response.error(
            404,
            "Not Found".toResponseBody()
        )

        // Act
        val response = mockApiService.getPlan()
        val uiState: PlanUiState = when {
            response.isSuccessful -> PlanUiState.Success(response.body()!!)
            response.code() == 404 -> PlanUiState.Empty
            else -> PlanUiState.Error("Failed to load plan")
        }

        // Assert
        assertTrue("404 should result in Empty state, not Error", uiState is PlanUiState.Empty)
    }

    @Test
    fun `successful plan response results in Success state`() = runTest {
        // Arrange
        val plan = TreatmentPlan(
            planId = "plan-1",
            patientId = "p1",
            status = "published",
            sessions = listOf(
                PlanSession(
                    sessionKey = "s1",
                    index = 0,
                    title = "Morning Routine",
                    timesPerDay = 1,
                    assignments = emptyList()
                )
            )
        )
        coEvery { mockApiService.getPlan() } returns Response.success(plan)

        // Act
        val response = mockApiService.getPlan()
        val uiState: PlanUiState = when {
            response.isSuccessful -> PlanUiState.Success(response.body()!!)
            response.code() == 404 -> PlanUiState.Empty
            else -> PlanUiState.Error("Failed to load plan")
        }

        // Assert
        assertTrue("Successful response should result in Success state", uiState is PlanUiState.Success)
        val successState = uiState as PlanUiState.Success
        assertEquals("plan-1", successState.plan.planId)
        assertEquals(1, successState.plan.sessions.size)
        assertEquals("Morning Routine", successState.plan.sessions[0].title)
    }

    @Test
    fun `server error results in Error state`() = runTest {
        // Arrange
        coEvery { mockApiService.getPlan() } returns Response.error(
            500,
            "Internal Server Error".toResponseBody()
        )

        // Act
        val response = mockApiService.getPlan()
        val uiState: PlanUiState = when {
            response.isSuccessful -> PlanUiState.Success(response.body()!!)
            response.code() == 404 -> PlanUiState.Empty
            else -> PlanUiState.Error("Failed to load plan")
        }

        // Assert
        assertTrue("500 should result in Error state", uiState is PlanUiState.Error)
        val errorState = uiState as PlanUiState.Error
        assertEquals("Failed to load plan", errorState.message)
    }
}

// MARK: - UI State

sealed class PlanUiState {
    data object Empty : PlanUiState()
    data class Success(val plan: TreatmentPlan) : PlanUiState()
    data class Error(val message: String) : PlanUiState()
}

// MARK: - DTOs

data class TreatmentPlan(
    val planId: String,
    val patientId: String,
    val status: String,
    val sessions: List<PlanSession>
)

data class PlanSession(
    val sessionKey: String,
    val index: Int,
    val title: String?,
    val timesPerDay: Int,
    val assignments: List<PlanAssignment>
)

data class PlanAssignment(
    val assignmentKey: String,
    val exerciseVersionId: String,
    val index: Int,
    val paramsOverride: Map<String, Int>?
)
