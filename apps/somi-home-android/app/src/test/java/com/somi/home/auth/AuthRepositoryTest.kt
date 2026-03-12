package com.somi.home.auth

import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.AuthState
import com.somi.home.core.auth.TokenManager
import com.somi.home.core.network.ApiService
import com.somi.home.core.network.NetworkResult
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

class AuthRepositoryTest {

    private val mockApiService = mockk<ApiService>()
    private val mockTokenManager = mockk<TokenManager>(relaxed = true)
    private lateinit var repository: AuthRepository

    @Before
    fun setUp() {
        repository = AuthRepository(mockApiService, mockTokenManager)
    }

    @Test
    fun `login builds correct Basic auth header`() = runTest {
        // Arrange
        val email = "patient@test.com"
        val password = "secret123"
        val expectedCredentials = android.util.Base64.encodeToString(
            "$email:$password".toByteArray(),
            android.util.Base64.NO_WRAP
        )

        val loginResponse = LoginResponse(
            accessToken = "access-abc",
            refreshToken = "refresh-xyz",
            expiresIn = 3600,
            user = UserInfo(
                userId = "u1",
                email = email,
                role = "client",
                patientId = "p1",
                displayName = "Test Patient"
            )
        )
        val meResponse = MeResponse(
            userId = "u1",
            email = email,
            role = "client",
            patientId = "p1",
            displayName = "Test Patient"
        )

        coEvery { mockApiService.login(any()) } returns Response.success(loginResponse)
        coEvery { mockApiService.getMe(any()) } returns Response.success(meResponse)

        // Act
        repository.login(email, password)

        // Assert — verify login was called with Basic auth header
        coVerify {
            mockApiService.login(match { header ->
                header.startsWith("Basic ")
            })
        }
    }

    @Test
    fun `login stores both access and refresh tokens`() = runTest {
        // Arrange
        val loginResponse = LoginResponse(
            accessToken = "access-abc",
            refreshToken = "refresh-xyz",
            expiresIn = 3600,
            user = UserInfo(
                userId = "u1",
                email = "patient@test.com",
                role = "client",
                patientId = "p1",
                displayName = "Test Patient"
            )
        )
        val meResponse = MeResponse(
            userId = "u1",
            email = "patient@test.com",
            role = "client",
            patientId = "p1",
            displayName = "Test Patient"
        )

        coEvery { mockApiService.login(any()) } returns Response.success(loginResponse)
        coEvery { mockApiService.getMe(any()) } returns Response.success(meResponse)

        // Act
        repository.login("patient@test.com", "secret123")

        // Assert
        verify { mockTokenManager.storeTokens("access-abc", "refresh-xyz") }
    }

    @Test
    fun `login with non-client role returns failure and signs out`() = runTest {
        // Arrange
        val loginResponse = LoginResponse(
            accessToken = "access-abc",
            refreshToken = "refresh-xyz",
            expiresIn = 3600,
            user = UserInfo(
                userId = "u1",
                email = "therapist@test.com",
                role = "therapist",
                patientId = null,
                displayName = "Dr. Smith"
            )
        )
        val meResponse = MeResponse(
            userId = "u1",
            email = "therapist@test.com",
            role = "therapist",
            patientId = null,
            displayName = "Dr. Smith"
        )

        coEvery { mockApiService.login(any()) } returns Response.success(loginResponse)
        coEvery { mockApiService.getMe(any()) } returns Response.success(meResponse)

        // Act
        val result = repository.login("therapist@test.com", "secret123")

        // Assert
        assertTrue("Login with non-client role should fail", result is NetworkResult.Error)
        verify { mockTokenManager.clearTokens() }
    }

    @Test
    fun `restoreSession with valid tokens sets Authenticated state`() = runTest {
        // Arrange
        every { mockTokenManager.getAccessToken() } returns "valid-token"
        val meResponse = MeResponse(
            userId = "u1",
            email = "patient@test.com",
            role = "client",
            patientId = "p1",
            displayName = "Test Patient"
        )
        coEvery { mockApiService.getMe(any()) } returns Response.success(meResponse)

        // Act
        val state = repository.restoreSession()

        // Assert
        assertTrue("Should be authenticated", state is AuthState.Authenticated)
        val authState = state as AuthState.Authenticated
        assertEquals("u1", authState.userId)
        assertEquals("p1", authState.patientId)
    }

    @Test
    fun `signOut clears tokens`() = runTest {
        // Arrange
        every { mockTokenManager.getRefreshToken() } returns "refresh-token"
        coEvery { mockApiService.logout(any()) } returns Response.success(Unit)

        // Act
        repository.signOut()

        // Assert
        verify { mockTokenManager.clearTokens() }
    }
}

// MARK: - DTOs referenced in tests (mirrors expected source models)

data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val user: UserInfo
)

data class UserInfo(
    val userId: String,
    val email: String,
    val role: String,
    val patientId: String?,
    val displayName: String?
)

data class MeResponse(
    val userId: String,
    val email: String,
    val role: String,
    val patientId: String?,
    val displayName: String?
)
