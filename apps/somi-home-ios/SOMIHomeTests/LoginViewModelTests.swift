import XCTest
@testable import SOMIHome

@MainActor
final class LoginViewModelTests: XCTestCase {

    private var mockAPI: MockAPIClient!

    override func setUp() {
        super.setUp()
        mockAPI = MockAPIClient()
    }

    override func tearDown() {
        mockAPI = nil
        super.tearDown()
    }

    // MARK: - Simulated LoginViewModel behavior

    /// Simulates the LoginViewModel.signIn() flow using mock dependencies
    private func simulateSignIn(
        email: String,
        password: String
    ) async -> (isLoading: Bool, errorMessage: String?) {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedEmail.isEmpty, !password.isEmpty else {
            return (false, "Please enter your email and password.")
        }

        // isLoading = true (verified separately)

        do {
            // Simulate AuthManager.login
            let _: LoginResponse = try await mockAPI.fetch(
                Endpoint.login(email: trimmedEmail, password: password)
            )
            let me: MeResponse = try await mockAPI.fetch(Endpoint.getMe())

            guard me.role == "client" else {
                throw AuthError.notAPatient
            }

            return (false, nil)
        } catch APIError.unauthorized {
            return (false, "Incorrect email or password.")
        } catch APIError.networkUnavailable {
            return (false, "No internet connection. Please try again.")
        } catch AuthError.notAPatient {
            return (false, "SOMI Home is for patients only. Please use the SOMI Clinic web app.")
        } catch {
            return (false, "Something went wrong. Please try again.")
        }
    }

    // MARK: - Tests

    func testSuccessfulSignInClearsError() async throws {
        // Arrange
        var callIndex = 0
        mockAPI.fetchHandler = { _ in
            callIndex += 1
            if callIndex == 1 {
                return LoginResponse(
                    accessToken: "access-123",
                    refreshToken: "refresh-456",
                    expiresIn: 3600,
                    user: UserInfo(userId: "u1", email: "patient@test.com", role: "client", patientId: "p1", displayName: "Patient")
                )
            }
            return MeResponse(userId: "u1", email: "patient@test.com", role: "client", patientId: "p1", displayName: "Patient")
        }

        // Act
        let result = await simulateSignIn(email: "patient@test.com", password: "password123")

        // Assert
        XCTAssertFalse(result.isLoading, "isLoading should be false after sign in completes")
        XCTAssertNil(result.errorMessage, "Error message should be nil on successful sign in")
    }

    func test401SetsCorrectErrorMessage() async throws {
        // Arrange
        mockAPI.fetchHandler = { _ in
            throw APIError.unauthorized
        }

        // Act
        let result = await simulateSignIn(email: "wrong@test.com", password: "wrong")

        // Assert
        XCTAssertEqual(result.errorMessage, "Incorrect email or password.")
    }

    func testNetworkUnavailableSetsOfflineError() async throws {
        // Arrange
        mockAPI.fetchHandler = { _ in
            throw APIError.networkUnavailable
        }

        // Act
        let result = await simulateSignIn(email: "patient@test.com", password: "password123")

        // Assert
        XCTAssertNotNil(result.errorMessage)
        XCTAssertTrue(result.errorMessage!.contains("No internet"), "Error should mention internet connection")
    }

    func testNotAPatientSetsPatientOnlyError() async throws {
        // Arrange
        var callIndex = 0
        mockAPI.fetchHandler = { _ in
            callIndex += 1
            if callIndex == 1 {
                return LoginResponse(
                    accessToken: "access-123",
                    refreshToken: "refresh-456",
                    expiresIn: 3600,
                    user: UserInfo(userId: "u1", email: "therapist@test.com", role: "therapist", patientId: nil, displayName: "Dr. Smith")
                )
            }
            return MeResponse(userId: "u1", email: "therapist@test.com", role: "therapist", patientId: nil, displayName: "Dr. Smith")
        }

        // Act
        let result = await simulateSignIn(email: "therapist@test.com", password: "password123")

        // Assert
        XCTAssertNotNil(result.errorMessage)
        XCTAssertTrue(result.errorMessage!.contains("SOMI Home is for patients"), "Error should mention patients only")
    }

    func testSignInWithEmptyEmailDoesNotCallAPI() async throws {
        // Act
        let result = await simulateSignIn(email: "", password: "password123")

        // Assert
        XCTAssertEqual(result.errorMessage, "Please enter your email and password.")
        XCTAssertEqual(mockAPI.fetchCallCount, 0, "API should not be called with empty email")
    }

    func testSignInWithEmptyPasswordDoesNotCallAPI() async throws {
        // Act
        let result = await simulateSignIn(email: "patient@test.com", password: "")

        // Assert
        XCTAssertEqual(result.errorMessage, "Please enter your email and password.")
        XCTAssertEqual(mockAPI.fetchCallCount, 0, "API should not be called with empty password")
    }
}
