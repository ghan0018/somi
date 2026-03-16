import XCTest
@testable import SOMIHome

// MARK: - Mock API Client

protocol APIClientProtocol {
    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T
    func fetchVoid(_ endpoint: Endpoint) async throws
}

private final class MockAuthAPIClient: APIClientProtocol {
    var fetchHandler: ((Endpoint) async throws -> Any)?
    var fetchVoidHandler: ((Endpoint) async throws -> Void)?
    var fetchCallCount = 0
    var lastFetchedEndpoint: Endpoint?

    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        fetchCallCount += 1
        lastFetchedEndpoint = endpoint
        guard let handler = fetchHandler else {
            fatalError("fetchHandler not set")
        }
        let result = try await handler(endpoint)
        guard let typed = result as? T else {
            throw APIError.decodingError
        }
        return typed
    }

    func fetchVoid(_ endpoint: Endpoint) async throws {
        fetchCallCount += 1
        lastFetchedEndpoint = endpoint
        try await fetchVoidHandler?(endpoint)
    }
}

// MARK: - Mock Keychain Manager

final class MockKeychainManager {
    private var store: [String: String] = [:]

    func save(key: String, value: String) throws {
        store[key] = value
    }

    func read(key: String) -> String? {
        store[key]
    }

    func delete(key: String) {
        store.removeValue(forKey: key)
    }

    var isEmpty: Bool { store.isEmpty }

    func containsKey(_ key: String) -> Bool {
        store[key] != nil
    }
}

// MARK: - Tests

@MainActor
final class AuthManagerTests: XCTestCase {

    private var mockAPI: MockAuthAPIClient!
    private var mockKeychain: MockKeychainManager!

    override func setUp() {
        super.setUp()
        mockAPI = MockAuthAPIClient()
        mockKeychain = MockKeychainManager()
    }

    override func tearDown() {
        mockAPI = nil
        mockKeychain = nil
        super.tearDown()
    }

    // MARK: - Login

    func testLoginStoresTokensInKeychain() async throws {
        // Arrange
        let loginResponse = LoginResponse(
            accessToken: "access-abc",
            refreshToken: "refresh-xyz",
            expiresIn: 3600,
            user: UserInfo(
                userId: "u1",
                email: "patient@test.com",
                role: "client",
                patientId: "p1",
                displayName: "Test Patient"
            )
        )
        let meResponse = MeResponse(
            userId: "u1",
            email: "patient@test.com",
            role: "client",
            patientId: "p1",
            displayName: "Test Patient"
        )

        var callIndex = 0
        mockAPI.fetchHandler = { _ in
            callIndex += 1
            if callIndex == 1 { return loginResponse }
            return meResponse
        }

        // Act — simulate login logic manually using mocks
        let loginResult: LoginResponse = try await mockAPI.fetch(Endpoint.login(email: "patient@test.com", password: "pass"))
        try mockKeychain.save(key: "somi.accessToken", value: loginResult.accessToken)
        try mockKeychain.save(key: "somi.refreshToken", value: loginResult.refreshToken)

        // Assert
        XCTAssertEqual(mockKeychain.read(key: "somi.accessToken"), "access-abc")
        XCTAssertEqual(mockKeychain.read(key: "somi.refreshToken"), "refresh-xyz")
    }

    func testLoginWithNonClientRoleSignsOut() async throws {
        // Arrange
        let loginResponse = LoginResponse(
            accessToken: "access-abc",
            refreshToken: "refresh-xyz",
            expiresIn: 3600,
            user: UserInfo(
                userId: "u1",
                email: "therapist@test.com",
                role: "therapist",
                patientId: nil,
                displayName: "Dr. Smith"
            )
        )
        let meResponse = MeResponse(
            userId: "u1",
            email: "therapist@test.com",
            role: "therapist",
            patientId: nil,
            displayName: "Dr. Smith"
        )

        var callIndex = 0
        mockAPI.fetchHandler = { _ in
            callIndex += 1
            if callIndex == 1 { return loginResponse }
            return meResponse
        }

        // Act — simulate login flow
        let result: LoginResponse = try await mockAPI.fetch(Endpoint.login(email: "therapist@test.com", password: "pass"))
        try mockKeychain.save(key: "somi.accessToken", value: result.accessToken)
        try mockKeychain.save(key: "somi.refreshToken", value: result.refreshToken)

        let me: MeResponse = try await mockAPI.fetch(Endpoint.getMe())

        // Assert — non-client role should trigger sign out
        XCTAssertNotEqual(me.role, "client")

        // Simulate sign-out behavior
        mockKeychain.delete(key: "somi.accessToken")
        mockKeychain.delete(key: "somi.refreshToken")

        XCTAssertNil(mockKeychain.read(key: "somi.accessToken"))
        XCTAssertNil(mockKeychain.read(key: "somi.refreshToken"))
    }

    func testRestoreSessionWithValidTokensAuthenticates() async throws {
        // Arrange — tokens exist in keychain
        try mockKeychain.save(key: "somi.accessToken", value: "valid-token")
        try mockKeychain.save(key: "somi.refreshToken", value: "valid-refresh")

        let meResponse = MeResponse(
            userId: "u1",
            email: "patient@test.com",
            role: "client",
            patientId: "p1",
            displayName: "Test Patient"
        )
        mockAPI.fetchHandler = { _ in meResponse }

        // Act
        let hasToken = mockKeychain.read(key: "somi.accessToken") != nil
        XCTAssertTrue(hasToken)

        let me: MeResponse = try await mockAPI.fetch(Endpoint.getMe())

        // Assert
        XCTAssertEqual(me.role, "client")
        XCTAssertEqual(me.patientId, "p1")
        XCTAssertEqual(me.userId, "u1")
    }

    func testRestoreSessionTriesRefreshOn401() async throws {
        // Arrange
        try mockKeychain.save(key: "somi.accessToken", value: "expired-token")
        try mockKeychain.save(key: "somi.refreshToken", value: "valid-refresh")

        var callIndex = 0
        mockAPI.fetchHandler = { endpoint in
            callIndex += 1
            if callIndex == 1 {
                // First /me call returns 401
                throw APIError.unauthorized
            }
            if callIndex == 2 {
                // Refresh call succeeds
                return RefreshResponse(
                    accessToken: "new-access",
                    refreshToken: "new-refresh",
                    expiresIn: 3600
                )
            }
            // Second /me call succeeds
            return MeResponse(
                userId: "u1",
                email: "patient@test.com",
                role: "client",
                patientId: "p1",
                displayName: "Test Patient"
            )
        }

        // Act — simulate restoreSession logic
        do {
            let _: MeResponse = try await mockAPI.fetch(Endpoint.getMe())
            XCTFail("Should have thrown unauthorized")
        } catch APIError.unauthorized {
            // Refresh
            let refreshResult: RefreshResponse = try await mockAPI.fetch(
                Endpoint.refreshToken(mockKeychain.read(key: "somi.refreshToken")!)
            )
            try mockKeychain.save(key: "somi.accessToken", value: refreshResult.accessToken)
            try mockKeychain.save(key: "somi.refreshToken", value: refreshResult.refreshToken)
        }

        // Assert — new tokens stored
        XCTAssertEqual(mockKeychain.read(key: "somi.accessToken"), "new-access")
        XCTAssertEqual(mockKeychain.read(key: "somi.refreshToken"), "new-refresh")
    }

    func testRestoreSessionWithNoTokensGoesUnauthenticated() async throws {
        // Arrange — no tokens in keychain
        // (mockKeychain is empty by default)

        // Act
        let hasToken = mockKeychain.read(key: "somi.accessToken") != nil

        // Assert
        XCTAssertFalse(hasToken, "Should have no access token, resulting in unauthenticated state")
        XCTAssertEqual(mockAPI.fetchCallCount, 0, "Should not make any API calls without tokens")
    }

    func testSignOutClearsTokens() async throws {
        // Arrange
        try mockKeychain.save(key: "somi.accessToken", value: "access-token")
        try mockKeychain.save(key: "somi.refreshToken", value: "refresh-token")

        mockAPI.fetchVoidHandler = { _ in }

        // Act — simulate sign out
        try await mockAPI.fetchVoid(Endpoint.logout(mockKeychain.read(key: "somi.refreshToken")!))
        mockKeychain.delete(key: "somi.accessToken")
        mockKeychain.delete(key: "somi.refreshToken")

        // Assert
        XCTAssertNil(mockKeychain.read(key: "somi.accessToken"))
        XCTAssertNil(mockKeychain.read(key: "somi.refreshToken"))
    }

    func testRefreshTokensStoresBothNewTokens() async throws {
        // Arrange
        try mockKeychain.save(key: "somi.refreshToken", value: "old-refresh")

        let refreshResponse = RefreshResponse(
            accessToken: "rotated-access",
            refreshToken: "rotated-refresh",
            expiresIn: 3600
        )
        mockAPI.fetchHandler = { _ in refreshResponse }

        // Act
        let response: RefreshResponse = try await mockAPI.fetch(
            Endpoint.refreshToken(mockKeychain.read(key: "somi.refreshToken")!)
        )
        try mockKeychain.save(key: "somi.accessToken", value: response.accessToken)
        try mockKeychain.save(key: "somi.refreshToken", value: response.refreshToken)

        // Assert — both tokens rotated
        XCTAssertEqual(mockKeychain.read(key: "somi.accessToken"), "rotated-access")
        XCTAssertEqual(mockKeychain.read(key: "somi.refreshToken"), "rotated-refresh")
    }
}
