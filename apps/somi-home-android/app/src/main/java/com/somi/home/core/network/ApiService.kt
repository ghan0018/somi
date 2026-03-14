package com.somi.home.core.network

import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.CompletionResponse
import com.somi.home.core.models.UncompletionRequest
import com.somi.home.core.models.LoginResponse
import com.somi.home.core.models.MeResponse
import com.somi.home.core.models.Message
import com.somi.home.core.models.MessageThread
import com.somi.home.core.models.PagedMessages
import com.somi.home.core.models.RefreshRequest
import com.somi.home.core.models.SendMessageRequest
import com.somi.home.core.models.TodayViewResponse
import com.somi.home.core.models.TokenResponse
import com.somi.home.core.models.TreatmentPlan
import com.somi.home.core.models.VideoAccessResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @POST("v1/auth/login")
    suspend fun login(@Header("Authorization") basicAuth: String): LoginResponse

    @POST("v1/auth/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): TokenResponse

    @POST("v1/auth/logout")
    suspend fun logout(@Body body: RefreshRequest)

    @GET("v1/me")
    suspend fun getMe(): MeResponse

    @GET("v1/me/today")
    suspend fun getToday(@Query("dateLocal") dateLocal: String): TodayViewResponse

    @POST("v1/me/completions")
    suspend fun postCompletion(
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body body: CompletionRequest
    ): CompletionResponse

    // Retrofit @DELETE doesn't support a body; use @HTTP with hasBody = true
    @HTTP(method = "DELETE", path = "v1/me/completions", hasBody = true)
    suspend fun deleteCompletion(@Body body: UncompletionRequest)

    @GET("v1/me/plan")
    suspend fun getPlan(): Response<TreatmentPlan>

    @GET("v1/me/messages/thread")
    suspend fun getThread(): MessageThread

    @GET("v1/messages/threads/{threadId}/messages")
    suspend fun listMessages(
        @Path("threadId") threadId: String,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50
    ): PagedMessages

    @POST("v1/messages/threads/{threadId}/messages")
    suspend fun sendMessage(
        @Path("threadId") threadId: String,
        @Body body: SendMessageRequest
    ): Message

    @POST("v1/uploads/{uploadId}/access")
    suspend fun getVideoAccess(@Path("uploadId") uploadId: String): VideoAccessResponse
}
