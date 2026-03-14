package com.somi.home.auth

import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.AuthState
import com.somi.home.core.auth.TokenManager
import com.somi.home.core.models.LoginResponse
import com.somi.home.core.models.MeResponse
import com.somi.home.core.models.UserInfo
import com.somi.home.core.network.ApiService
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for AuthRepository.
 *
 * Note: AuthRepository.login() uses android.util.Base64 to encode credentials.
 * android.util.Base64 is not available in pure JVM unit tests (it returns empty string),
 * so tests that exercise the full login() flow are covered by the restoreSession / signOut
 * paths that do not require Base64.
 */
class AuthRepositoryTest {

    private val mockApiService = mockk<ApiService>()
    private val mockTokenManager = mockk<TokenManager>(relaxed = true)
    private lateinit var repository: AuthRepository

    @Before
    fun setUp() {
        repository = AuthRepository(mockApiService, mockTokenManager)
    }

    private fun makeMeResponse(role: String = "client", patientId: String? = "p1") = MeResponse(
        userId = "u1",
        email = "patient@test.com",
        role = role,
        patientId = patientId,
        displayName = "Test Patient"
    )

    @Test
    fun `login with non-client role returns failure and clears tokens`() = runTest {
        // android.util.Base64 returns empty string in JVM unit tests, so login() still calls API
        coEvery { mockApiService.login(any()) } returns LoginResponse(
            accessToken = "access-abc",
            refreshToken = "refresh-xyz",
            expiresIn = 3600,
            user = UserInfo(userId = "u1", email = "therapist@test.com", role = "therapist", patientId = null, displayName = "Dr. Smith")
        )
        coEvery { mockApiService.getMe() } returns makeMeResponse(role = "therapist", patientId = null)
        coEvery { mockApiService.logout(any()) } returns Unit

        val result = repository.login("therapist@test.com", "secret123")

        assertTrue("Login with non-client role should fail", result.isFailure)
        verify { mockTokenManager.clearTokens() }
    }

    @Test
    fun `restoreSession with no stored token stays unauthenticated`() = runTest {
        every { mockTokenManager.getAccessToken() } returns null

        repository.restoreSession()

        val state = repository.authState.value
        assertTrue("Should remain unauthenticated", state is AuthState.Unauthenticated)
    }

    @Test
    fun `restoreSession with valid token sets Authenticated state`() = runTest {
        every { mockTokenManager.getAccessToken() } returns "valid-token"
        coEvery { mockApiService.getMe() } returns makeMeResponse()

        repository.restoreSession()

        val state = repository.authState.value
        assertTrue("Should be authenticated", state is AuthState.Authenticated)
        assertEquals("u1", (state as AuthState.Authenticated).userId)
        assertEquals("p1", state.patientId)
    }

    @Test
    fun `restoreSession with non-client role stays unauthenticated`() = runTest {
        every { mockTokenManager.getAccessToken() } returns "valid-token"
        coEvery { mockApiService.getMe() } returns makeMeResponse(role = "therapist", patientId = null)
        coEvery { mockApiService.logout(any()) } returns Unit

        repository.restoreSession()

        val state = repository.authState.value
        assertTrue("Should be unauthenticated", state is AuthState.Unauthenticated)
        verify { mockTokenManager.clearTokens() }
    }

    @Test
    fun `signOut clears tokens`() = runTest {
        every { mockTokenManager.getRefreshToken() } returns "refresh-token"
        coEvery { mockApiService.logout(any()) } returns Unit

        repository.signOut()

        verify { mockTokenManager.clearTokens() }
    }

    @Test
    fun `signOut when no refresh token still clears tokens`() = runTest {
        every { mockTokenManager.getRefreshToken() } returns null

        repository.signOut()

        verify { mockTokenManager.clearTokens() }
    }
}
