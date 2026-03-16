package com.somi.home.core.network

import com.somi.home.core.auth.TokenManager
import com.somi.home.core.models.RefreshRequest
import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

class UnauthorizedException : Exception("Session expired. Please sign in again.")

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
    private val moshi: Moshi
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Don't add auth header to login or refresh endpoints
        if (originalRequest.url.encodedPath.endsWith("/auth/login") ||
            originalRequest.url.encodedPath.endsWith("/auth/refresh")
        ) {
            return chain.proceed(originalRequest)
        }

        val accessToken = tokenManager.getAccessToken()
            ?: return chain.proceed(originalRequest)

        val authenticatedRequest = originalRequest.newBuilder()
            .header("Authorization", "Bearer $accessToken")
            .build()

        val response = chain.proceed(authenticatedRequest)

        if (response.code == 401) {
            response.close()
            return handleTokenRefresh(chain, originalRequest)
        }

        return response
    }

    private fun handleTokenRefresh(chain: Interceptor.Chain, originalRequest: Request): Response {
        return runBlocking {
            tokenManager.withRefreshLock {
                val refreshToken = tokenManager.getRefreshToken()
                    ?: throw UnauthorizedException()

                val refreshRequest = buildRefreshRequest(chain, refreshToken)
                val refreshResponse = chain.proceed(refreshRequest)

                if (!refreshResponse.isSuccessful) {
                    refreshResponse.close()
                    tokenManager.clearTokens()
                    throw UnauthorizedException()
                }

                val responseBody = refreshResponse.body?.string()
                refreshResponse.close()

                if (responseBody == null) {
                    tokenManager.clearTokens()
                    throw UnauthorizedException()
                }

                val tokenResponse = moshi.adapter(com.somi.home.core.models.TokenResponse::class.java)
                    .fromJson(responseBody)

                if (tokenResponse == null) {
                    tokenManager.clearTokens()
                    throw UnauthorizedException()
                }

                tokenManager.storeTokens(tokenResponse.accessToken, tokenResponse.refreshToken)

                // Retry the original request with new token
                val retryRequest = originalRequest.newBuilder()
                    .header("Authorization", "Bearer ${tokenResponse.accessToken}")
                    .build()

                val retryResponse = chain.proceed(retryRequest)

                if (retryResponse.code == 401) {
                    retryResponse.close()
                    tokenManager.clearTokens()
                    throw UnauthorizedException()
                }

                retryResponse
            }
        }
    }

    private fun buildRefreshRequest(chain: Interceptor.Chain, refreshToken: String): Request {
        val refreshBody = moshi.adapter(RefreshRequest::class.java)
            .toJson(RefreshRequest(refreshToken))

        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = refreshBody.toRequestBody(mediaType)

        val baseUrl = chain.request().url.newBuilder()
            .encodedPath("/v1/auth/refresh")
            .build()

        return Request.Builder()
            .url(baseUrl)
            .post(requestBody)
            .build()
    }
}
