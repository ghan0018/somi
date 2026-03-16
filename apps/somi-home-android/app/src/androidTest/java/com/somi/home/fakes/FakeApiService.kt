package com.somi.home.fakes

import com.somi.home.core.models.CompletionEntry
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.models.CompletionResponse
import com.somi.home.core.models.ExerciseInfo
import com.somi.home.core.models.ExerciseParams
import com.somi.home.core.models.LoginResponse
import com.somi.home.core.models.MeResponse
import com.somi.home.core.models.Message
import com.somi.home.core.models.MessageThread
import com.somi.home.core.models.PagedMessages
import com.somi.home.core.models.RefreshRequest
import com.somi.home.core.models.SendMessageRequest
import com.somi.home.core.models.TodayAssignment
import com.somi.home.core.models.TodayViewResponse
import com.somi.home.core.models.TokenResponse
import com.somi.home.core.models.TreatmentPlan
import com.somi.home.core.models.UncompletionRequest
import com.somi.home.core.models.VideoAccessResponse
import com.somi.home.core.network.ApiService
import retrofit2.Response

class FakeApiService : ApiService {

    var todayResponse: TodayViewResponse = makeDefaultTodayResponse()
    var completionError: Exception? = null
    val completionCalls = mutableListOf<CompletionRequest>()
    val deletionCalls = mutableListOf<UncompletionRequest>()

    override suspend fun login(basicAuth: String): LoginResponse {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun refreshToken(body: RefreshRequest): TokenResponse {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun logout(body: RefreshRequest) {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun getMe(): MeResponse {
        return MeResponse(
            userId = "user-test-1",
            email = "test@somi.app",
            role = "client",
            patientId = "patient-1",
            displayName = "Test User"
        )
    }

    override suspend fun getToday(dateLocal: String): TodayViewResponse {
        return todayResponse
    }

    override suspend fun postCompletion(idempotencyKey: String, body: CompletionRequest): CompletionResponse {
        completionError?.let { throw it }
        completionCalls.add(body)
        return CompletionResponse(
            completionId = "completion-${body.exerciseVersionId}-${body.occurrence}",
            completedAt = "2026-03-14T10:00:00Z"
        )
    }

    override suspend fun deleteCompletion(body: UncompletionRequest) {
        deletionCalls.add(body)
    }

    override suspend fun getPlan(): Response<TreatmentPlan> {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun getThread(): MessageThread {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun listMessages(threadId: String, cursor: String?, limit: Int): PagedMessages {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun sendMessage(threadId: String, body: SendMessageRequest): Message {
        throw NotImplementedError("Not used in UI tests")
    }

    override suspend fun getVideoAccess(uploadId: String): VideoAccessResponse {
        return VideoAccessResponse(
            accessUrl = "https://cdn.example.com/videos/$uploadId.mp4",
            expiresAt = "2026-03-14T11:00:00Z"
        )
    }

    fun reset() {
        todayResponse = makeDefaultTodayResponse()
        completionError = null
        completionCalls.clear()
        deletionCalls.clear()
    }

    companion object {
        fun makeDefaultTodayResponse(
            timesPerDay: Int = 1,
            sessionNotes: String? = null
        ) = TodayViewResponse(
            dateLocal = "2026-03-14",
            sessionKey = "session-1",
            sessionTitle = "Morning Routine",
            sessionNotes = sessionNotes,
            timesPerDay = timesPerDay,
            assignments = listOf(
                TodayAssignment(
                    assignmentKey = "assignment-1",
                    exerciseVersionId = "ev-1",
                    exercise = ExerciseInfo(
                        title = "Tongue Press",
                        description = "Press tongue to palate and hold.",
                        defaultParams = null,
                        mediaId = "media-1"
                    ),
                    effectiveParams = ExerciseParams(reps = 10, sets = 3, seconds = null),
                    completions = (1..timesPerDay).map { occ ->
                        CompletionEntry(occurrence = occ, completed = false, completedAt = null)
                    }
                ),
                TodayAssignment(
                    assignmentKey = "assignment-2",
                    exerciseVersionId = "ev-2",
                    exercise = ExerciseInfo(
                        title = "Nasal Breathing",
                        description = "Breathe through the nose for 5 minutes.",
                        defaultParams = null,
                        mediaId = null
                    ),
                    effectiveParams = ExerciseParams(reps = null, sets = null, seconds = 300),
                    completions = (1..timesPerDay).map { occ ->
                        CompletionEntry(occurrence = occ, completed = false, completedAt = null)
                    }
                )
            ),
            overallCompletionRate = 0.0
        )

        fun makeAllDoneResponse(timesPerDay: Int = 1) = TodayViewResponse(
            dateLocal = "2026-03-14",
            sessionKey = "session-done",
            sessionTitle = "Morning Routine",
            sessionNotes = null,
            timesPerDay = timesPerDay,
            assignments = listOf(
                TodayAssignment(
                    assignmentKey = "assignment-1",
                    exerciseVersionId = "ev-1",
                    exercise = ExerciseInfo(
                        title = "Tongue Press",
                        description = "Press tongue to palate and hold.",
                        defaultParams = null,
                        mediaId = null
                    ),
                    effectiveParams = ExerciseParams(reps = 10, sets = 3, seconds = null),
                    completions = (1..timesPerDay).map { occ ->
                        CompletionEntry(occurrence = occ, completed = true, completedAt = "2026-03-14T09:00:00Z")
                    }
                )
            ),
            overallCompletionRate = 1.0
        )

        fun makeEmptyResponse() = TodayViewResponse(
            dateLocal = "2026-03-14",
            sessionKey = "session-empty",
            sessionTitle = null,
            sessionNotes = null,
            timesPerDay = 1,
            assignments = emptyList(),
            overallCompletionRate = 0.0
        )

        fun makeCongratsResponse() = TodayViewResponse(
            dateLocal = "2026-03-14",
            sessionKey = "session-congrats",
            sessionTitle = "Morning Routine",
            sessionNotes = null,
            timesPerDay = 2,
            assignments = listOf(
                TodayAssignment(
                    assignmentKey = "assignment-congrats",
                    exerciseVersionId = "ev-congrats",
                    exercise = ExerciseInfo(
                        title = "Lip Seal",
                        description = "Keep lips sealed at rest.",
                        defaultParams = null,
                        mediaId = null
                    ),
                    effectiveParams = ExerciseParams(reps = 5, sets = null, seconds = null),
                    completions = listOf(
                        CompletionEntry(occurrence = 1, completed = false, completedAt = null),
                        CompletionEntry(occurrence = 2, completed = false, completedAt = null)
                    )
                )
            ),
            overallCompletionRate = 0.0
        )
    }
}
