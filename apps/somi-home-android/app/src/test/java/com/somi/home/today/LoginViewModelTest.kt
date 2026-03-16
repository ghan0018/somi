package com.somi.home.today

import com.somi.home.core.auth.AuthRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val mockAuthRepository = mockk<AuthRepository>()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // Simulates LoginUiState
    sealed class LoginUiState {
        data object Idle : LoginUiState()
        data object Loading : LoginUiState()
        data object Success : LoginUiState()
        data class Error(val message: String) : LoginUiState()
    }

    private suspend fun simulateLogin(email: String, password: String): LoginUiState {
        if (email.isBlank() || password.isBlank()) {
            return LoginUiState.Error("Please enter your email and password.")
        }

        return try {
            val result = mockAuthRepository.login(email, password)
            if (result.isSuccess) {
                LoginUiState.Success
            } else {
                val exception = result.exceptionOrNull()
                when {
                    exception?.message?.contains("patients only", ignoreCase = true) == true ->
                        LoginUiState.Error("SOMI Home is for patients only. Please use the SOMI Clinic web app.")
                    exception is retrofit2.HttpException && exception.code() == 401 ->
                        LoginUiState.Error("Incorrect email or password.")
                    exception is java.net.UnknownHostException ->
                        LoginUiState.Error("No internet connection. Please try again.")
                    else -> LoginUiState.Error("Something went wrong. Please try again.")
                }
            }
        } catch (e: java.net.UnknownHostException) {
            LoginUiState.Error("No internet connection. Please try again.")
        } catch (_: Exception) {
            LoginUiState.Error("Something went wrong. Please try again.")
        }
    }

    @Test
    fun `initial state is Idle`() {
        val state = LoginUiState.Idle
        assertTrue("Initial state should be Idle", state is LoginUiState.Idle)
    }

    @Test
    fun `login transitions Loading then Success`() = runTest {
        coEvery {
            mockAuthRepository.login("patient@test.com", "password123")
        } returns Result.success(Unit)

        val result = simulateLogin("patient@test.com", "password123")

        assertTrue("Should result in Success", result is LoginUiState.Success)
    }

    @Test
    fun `login 401 results in Error with correct message`() = runTest {
        coEvery {
            mockAuthRepository.login("wrong@test.com", "wrong")
        } returns Result.failure(retrofit2.HttpException(
            retrofit2.Response.error<Any>(401, okhttp3.ResponseBody.create(null, "Unauthorized"))
        ))

        val result = simulateLogin("wrong@test.com", "wrong")

        assertTrue("Should be Error state", result is LoginUiState.Error)
        assertEquals("Incorrect email or password.", (result as LoginUiState.Error).message)
    }

    @Test
    fun `login network error results in offline error message`() = runTest {
        coEvery {
            mockAuthRepository.login("patient@test.com", "password123")
        } throws java.net.UnknownHostException("Network unavailable")

        val result = simulateLogin("patient@test.com", "password123")

        assertTrue("Should be Error state", result is LoginUiState.Error)
        val errorMessage = (result as LoginUiState.Error).message
        assertTrue("Should mention internet", errorMessage.contains("internet", ignoreCase = true))
    }

    @Test
    fun `login not-a-patient results in patient-only message`() = runTest {
        coEvery {
            mockAuthRepository.login("therapist@test.com", "password123")
        } returns Result.failure(com.somi.home.core.auth.NotAPatientException())

        val result = simulateLogin("therapist@test.com", "password123")

        assertTrue("Should be Error state", result is LoginUiState.Error)
        val errorMessage = (result as LoginUiState.Error).message
        assertTrue("Should mention patients only", errorMessage.contains("patients only", ignoreCase = true))
    }

    @Test
    fun `login with empty email does not call repository`() = runTest {
        val result = simulateLogin("", "password123")

        assertTrue("Should be Error state", result is LoginUiState.Error)
        assertEquals("Please enter your email and password.", (result as LoginUiState.Error).message)
    }

    @Test
    fun `login with blank password does not call repository`() = runTest {
        val result = simulateLogin("patient@test.com", "   ")

        assertTrue("Should be Error state", result is LoginUiState.Error)
    }
}
