import Foundation

enum APIError: Error, Equatable {
    case unauthorized
    case networkUnavailable
    case serverError(Int)
    case decodingError
    case unknown
}

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String
    private var isRefreshing = false
    private var refreshContinuations: [CheckedContinuation<String, Error>] = []

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)

        if let plistURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !plistURL.isEmpty {
            self.baseURL = plistURL
        } else {
            self.baseURL = "http://localhost:3000"
        }
    }

    // MARK: - Public

    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let data = try await performRequest(endpoint, retry: true)
        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError
        }
    }

    func fetchVoid(_ endpoint: Endpoint) async throws {
        _ = try await performRequest(endpoint, retry: true)
    }

    // MARK: - Internal request pipeline

    private func performRequest(_ endpoint: Endpoint, retry: Bool) async throws -> Data {
        let request = try await buildRequest(endpoint)
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError {
            if urlError.code == .notConnectedToInternet ||
               urlError.code == .networkConnectionLost ||
               urlError.code == .timedOut ||
               urlError.code == .cannotFindHost ||
               urlError.code == .cannotConnectToHost {
                throw APIError.networkUnavailable
            }
            throw APIError.unknown
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }

        switch httpResponse.statusCode {
        case 200...299:
            return data
        case 401:
            if retry && !endpoint.path.contains("/auth/") {
                _ = try await refreshTokensDeduped()
                return try await performRequest(endpoint, retry: false)
            }
            await AuthManager.shared.signOut()
            throw APIError.unauthorized
        case 409:
            return data
        case 400...499:
            throw APIError.serverError(httpResponse.statusCode)
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode)
        default:
            throw APIError.unknown
        }
    }

    private func buildRequest(_ endpoint: Endpoint) async throws -> URLRequest {
        var urlString = baseURL + endpoint.path
        if !endpoint.queryParams.isEmpty {
            let queryItems = endpoint.queryParams.map { URLQueryItem(name: $0.key, value: $0.value) }
            var components = URLComponents(string: urlString)!
            components.queryItems = queryItems
            urlString = components.url!.absoluteString
        }

        guard let url = URL(string: urlString) else {
            throw APIError.unknown
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue

        // Default headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Auth token (skip for login/refresh)
        if !endpoint.path.contains("/auth/") {
            if let token = await AuthManager.shared.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        // Endpoint-specific headers
        for (key, value) in endpoint.headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        request.httpBody = endpoint.body
        return request
    }

    // MARK: - Token refresh deduplication

    private func refreshTokensDeduped() async throws -> String {
        if isRefreshing {
            return try await withCheckedThrowingContinuation { continuation in
                refreshContinuations.append(continuation)
            }
        }

        isRefreshing = true
        do {
            let newToken = try await AuthManager.shared.refreshTokens()
            let waiters = refreshContinuations
            refreshContinuations = []
            isRefreshing = false
            for waiter in waiters {
                waiter.resume(returning: newToken)
            }
            return newToken
        } catch {
            let waiters = refreshContinuations
            refreshContinuations = []
            isRefreshing = false
            for waiter in waiters {
                waiter.resume(throwing: error)
            }
            throw error
        }
    }
}
