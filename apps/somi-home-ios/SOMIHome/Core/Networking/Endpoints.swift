import Foundation

enum HTTPMethod: String {
    case GET, POST, PUT, PATCH, DELETE
}

struct Endpoint {
    let path: String
    let method: HTTPMethod
    var headers: [String: String] = [:]
    var body: Data?
    var queryParams: [String: String] = [:]

    // MARK: - Auth

    static func login(email: String, password: String) -> Endpoint {
        let credentials = "\(email):\(password)"
        let base64 = Data(credentials.utf8).base64EncodedString()
        return Endpoint(
            path: "/v1/auth/login",
            method: .POST,
            headers: ["Authorization": "Basic \(base64)"]
        )
    }

    static func refreshToken(_ token: String) -> Endpoint {
        let body = try? JSONEncoder().encode(["refreshToken": token])
        return Endpoint(
            path: "/v1/auth/refresh",
            method: .POST,
            body: body
        )
    }

    static func logout(_ refreshToken: String) -> Endpoint {
        let body = try? JSONEncoder().encode(["refreshToken": refreshToken])
        return Endpoint(
            path: "/v1/auth/logout",
            method: .POST,
            body: body
        )
    }

    // MARK: - Me

    static func getMe() -> Endpoint {
        Endpoint(path: "/v1/me", method: .GET)
    }

    // MARK: - Today

    static func getToday(dateLocal: String) -> Endpoint {
        Endpoint(
            path: "/v1/me/today",
            method: .GET,
            queryParams: ["dateLocal": dateLocal]
        )
    }

    // MARK: - Completions

    static func postCompletion(
        dateLocal: String,
        occurrence: Int,
        exerciseVersionId: String,
        source: String,
        idempotencyKey: String
    ) -> Endpoint {
        let payload = CompletionRequest(
            dateLocal: dateLocal,
            occurrence: occurrence,
            exerciseVersionId: exerciseVersionId,
            source: source
        )
        let body = try? JSONEncoder().encode(payload)
        return Endpoint(
            path: "/v1/me/completions",
            method: .POST,
            headers: ["Idempotency-Key": idempotencyKey],
            body: body
        )
    }

    static func deleteCompletion(
        dateLocal: String,
        occurrence: Int,
        exerciseVersionId: String
    ) -> Endpoint {
        let payload = CompletionRequest(
            dateLocal: dateLocal,
            occurrence: occurrence,
            exerciseVersionId: exerciseVersionId,
            source: "mobile_ios"
        )
        let body = try? JSONEncoder().encode(payload)
        return Endpoint(
            path: "/v1/me/completions",
            method: .DELETE,
            body: body
        )
    }

    // MARK: - Plan

    static func getPlan() -> Endpoint {
        Endpoint(path: "/v1/me/plan", method: .GET)
    }

    // MARK: - Messages

    static func getThread() -> Endpoint {
        Endpoint(path: "/v1/me/thread", method: .GET)
    }

    static func listMessages(threadId: String, cursor: String?, limit: Int) -> Endpoint {
        var params: [String: String] = ["limit": "\(limit)"]
        if let cursor { params["cursor"] = cursor }
        return Endpoint(
            path: "/v1/me/threads/\(threadId)/messages",
            method: .GET,
            queryParams: params
        )
    }

    static func sendMessage(threadId: String, text: String) -> Endpoint {
        let payload = SendMessageRequest(text: text, attachmentUploadIds: [])
        let body = try? JSONEncoder().encode(payload)
        return Endpoint(
            path: "/v1/me/threads/\(threadId)/messages",
            method: .POST,
            body: body
        )
    }

    // MARK: - Uploads

    static func accessUpload(uploadId: String) -> Endpoint {
        Endpoint(
            path: "/v1/uploads/\(uploadId)/access",
            method: .POST
        )
    }
}
