package com.somi.home.core.models

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LoginResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int,
    val user: UserInfo
)

@JsonClass(generateAdapter = true)
data class UserInfo(
    val userId: String,
    val email: String,
    val role: String,
    val patientId: String?,
    val displayName: String?
)

@JsonClass(generateAdapter = true)
data class MeResponse(
    val userId: String,
    val email: String,
    val role: String,
    val patientId: String?,
    val displayName: String?
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(val refreshToken: String)

@JsonClass(generateAdapter = true)
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Int
)

@JsonClass(generateAdapter = true)
data class TodayViewResponse(
    val dateLocal: String,
    val sessionKey: String,
    val sessionTitle: String?,
    val sessionNotes: String?,
    val timesPerDay: Int,
    val assignments: List<TodayAssignment>,
    val overallCompletionRate: Double
)

@JsonClass(generateAdapter = true)
data class TodayAssignment(
    val assignmentKey: String,
    val exerciseVersionId: String,
    val exercise: ExerciseInfo,
    // Backend returns pre-merged params under this key (default + any plan override applied).
    val effectiveParams: ExerciseParams?,
    val completions: List<CompletionEntry>
)

@JsonClass(generateAdapter = true)
data class ExerciseInfo(
    val title: String,
    val description: String,
    // Absent from today-view responses (backend pre-merges into effectiveParams);
    // present in plan-view responses.
    val defaultParams: ExerciseParams?,
    val mediaId: String?
)

@JsonClass(generateAdapter = true)
data class ExerciseParams(
    val reps: Int?,
    val sets: Int?,
    val seconds: Int?
)

@JsonClass(generateAdapter = true)
data class CompletionEntry(
    val occurrence: Int,
    val completed: Boolean,
    val completedAt: String? // null when not yet completed
)

@JsonClass(generateAdapter = true)
data class TreatmentPlan(
    val planId: String,
    val patientId: String,
    val status: String,
    val sessions: List<PlanSession>
)

@JsonClass(generateAdapter = true)
data class PlanSession(
    val sessionKey: String,
    val index: Int,
    val title: String?,
    val timesPerDay: Int,
    val assignments: List<PlanAssignment>
)

@JsonClass(generateAdapter = true)
data class PlanAssignment(
    val assignmentKey: String,
    val exerciseVersionId: String,
    val index: Int,
    val exercise: ExerciseInfo?,
    val paramsOverride: ExerciseParams?
)

@JsonClass(generateAdapter = true)
data class MessageThread(
    val threadId: String,
    val patientId: String,
    val therapistUserId: String,
    val status: String,
    val lastMessageAt: String?
)

@JsonClass(generateAdapter = true)
data class Message(
    val messageId: String,
    val threadId: String,
    val senderUserId: String,
    val senderRole: String,
    val text: String,
    val createdAt: String
)

@JsonClass(generateAdapter = true)
data class PagedMessages(
    val items: List<Message>,
    val nextCursor: String?
)

@JsonClass(generateAdapter = true)
data class SendMessageRequest(
    val text: String,
    val attachmentUploadIds: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CompletionRequest(
    val dateLocal: String,
    val occurrence: Int,
    val exerciseVersionId: String,
    val source: String
)

@JsonClass(generateAdapter = true)
data class UncompletionRequest(
    val dateLocal: String,
    val occurrence: Int,
    val exerciseVersionId: String
)

@JsonClass(generateAdapter = true)
data class CompletionResponse(
    val completionId: String,
    val completedAt: String
)

@JsonClass(generateAdapter = true)
data class VideoAccessResponse(
    val accessUrl: String,
    val expiresAt: String
)
