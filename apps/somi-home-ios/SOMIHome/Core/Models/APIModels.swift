import Foundation

// MARK: - Auth

struct LoginResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: UserInfo
}

struct UserInfo: Codable {
    let userId: String
    let email: String
    let role: String
    let patientId: String?
    let displayName: String?
}

struct MeResponse: Codable {
    let userId: String
    let email: String
    let role: String
    let patientId: String?
    let displayName: String?
}

struct RefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

// MARK: - Today View

struct TodayViewResponse: Codable {
    let planId: String
    let dateLocal: String
    let sessions: [TodaySession]
}

struct TodaySession: Codable {
    let sessionKey: String
    let title: String?
    let timesPerDay: Int
    let assignments: [TodayAssignment]
}

struct TodayAssignment: Codable, Identifiable {
    var id: String { assignmentKey }
    let assignmentKey: String
    let exerciseVersionId: String
    let exercise: ExerciseInfo
    let paramsOverride: ExerciseParams?
    let completions: [CompletionEntry]
}

struct ExerciseInfo: Codable {
    let title: String
    let description: String
    let defaultParams: ExerciseParams
    let mediaId: String?
}

struct ExerciseParams: Codable {
    let reps: Int?
    let sets: Int?
    let seconds: Int?
}

struct CompletionEntry: Codable {
    let occurrence: Int
    let completedAt: String
}

// MARK: - Treatment Plan

struct TreatmentPlan: Codable {
    let planId: String
    let patientId: String
    let status: String
    let sessions: [PlanSession]
}

struct PlanSession: Codable, Identifiable {
    var id: String { sessionKey }
    let sessionKey: String
    let index: Int
    let title: String?
    let timesPerDay: Int
    let assignments: [PlanAssignment]
}

struct PlanAssignment: Codable, Identifiable {
    var id: String { assignmentKey }
    let assignmentKey: String
    let exerciseVersionId: String
    let index: Int
    let exercise: ExerciseInfo?
    let paramsOverride: ExerciseParams?
}

// MARK: - Messages

struct MessageThread: Codable {
    let threadId: String
    let patientId: String
    let therapistUserId: String
    let status: String
    let lastMessageAt: String?
}

struct Message: Codable, Identifiable {
    var id: String { messageId }
    let messageId: String
    let threadId: String
    let senderUserId: String
    let senderRole: String
    let text: String
    let createdAt: String
}

struct PagedMessages: Codable {
    let items: [Message]
    let nextCursor: String?
}

struct SendMessageRequest: Codable {
    let text: String
    let attachmentUploadIds: [String]
}

// MARK: - Uploads

struct VideoAccessResponse: Codable {
    let accessUrl: String
    let expiresAt: String
}

// MARK: - Completions

struct CompletionRequest: Codable {
    let dateLocal: String
    let occurrence: Int
    let exerciseVersionId: String
    let source: String
}

struct CompletionResponse: Codable {
    let completionId: String
    let completedAt: String
}
