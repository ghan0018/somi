package com.somi.home.core.auth

import android.util.Base64
import com.somi.home.core.models.RefreshRequest
import com.somi.home.core.network.ApiService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

class NotAPatientException : Exception("SOMI Home is for patients only. Please use the SOMI Clinic web app.")

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val tokenManager: TokenManager
) {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Unauthenticated)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    fun isLoggedIn(): Boolean = tokenManager.getAccessToken() != null

    suspend fun login(email: String, password: String): Result<Unit> {
        return try {
            val credentials = "$email:$password"
            val encoded = Base64.encodeToString(credentials.toByteArray(), Base64.NO_WRAP)
            val basicAuth = "Basic $encoded"

            val loginResponse = apiService.login(basicAuth)
            tokenManager.storeTokens(loginResponse.accessToken, loginResponse.refreshToken)

            val me = apiService.getMe()
            if (me.role != "client") {
                signOut()
                return Result.failure(NotAPatientException())
            }

            _authState.value = AuthState.Authenticated(
                userId = me.userId,
                patientId = me.patientId ?: "",
                displayName = me.displayName ?: me.email
            )
            Result.success(Unit)
        } catch (e: Exception) {
            tokenManager.clearTokens()
            Result.failure(e)
        }
    }

    suspend fun restoreSession() {
        if (!isLoggedIn()) return

        try {
            val me = apiService.getMe()
            if (me.role != "client") {
                signOut()
                return
            }
            _authState.value = AuthState.Authenticated(
                userId = me.userId,
                patientId = me.patientId ?: "",
                displayName = me.displayName ?: me.email
            )
        } catch (e: HttpException) {
            if (e.code() == 401) {
                // Try refreshing the token
                val refreshToken = tokenManager.getRefreshToken()
                if (refreshToken != null) {
                    try {
                        val tokenResponse = apiService.refreshToken(RefreshRequest(refreshToken))
                        tokenManager.storeTokens(tokenResponse.accessToken, tokenResponse.refreshToken)
                        val me = apiService.getMe()
                        _authState.value = AuthState.Authenticated(
                            userId = me.userId,
                            patientId = me.patientId ?: "",
                            displayName = me.displayName ?: me.email
                        )
                    } catch (_: Exception) {
                        tokenManager.clearTokens()
                        _authState.value = AuthState.Unauthenticated
                    }
                } else {
                    tokenManager.clearTokens()
                    _authState.value = AuthState.Unauthenticated
                }
            } else {
                tokenManager.clearTokens()
                _authState.value = AuthState.Unauthenticated
            }
        } catch (_: Exception) {
            tokenManager.clearTokens()
            _authState.value = AuthState.Unauthenticated
        }
    }

    suspend fun signOut() {
        try {
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken != null) {
                apiService.logout(RefreshRequest(refreshToken))
            }
        } catch (_: Exception) {
            // Best-effort logout
        } finally {
            tokenManager.clearTokens()
            _authState.value = AuthState.Unauthenticated
        }
    }
}
