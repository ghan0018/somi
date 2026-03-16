import Foundation

enum AuthError: Error {
    case notAPatient
    case noRefreshToken
}

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    enum AuthState {
        case unauthenticated
        case loading
        case authenticated(userId: String, patientId: String, displayName: String)
    }

    @Published var state: AuthState = .loading

    private init() {}

    var accessToken: String? {
        KeychainManager.shared.read(key: "somi.accessToken")
    }

    private var refreshToken: String? {
        KeychainManager.shared.read(key: "somi.refreshToken")
    }

    // MARK: - Login

    func login(email: String, password: String) async throws {
        let endpoint = Endpoint.login(email: email, password: password)
        let response: LoginResponse = try await APIClient.shared.fetch(endpoint)

        try KeychainManager.shared.save(key: "somi.accessToken", value: response.accessToken)
        try KeychainManager.shared.save(key: "somi.refreshToken", value: response.refreshToken)

        let me: MeResponse = try await APIClient.shared.fetch(Endpoint.getMe())

        guard me.role == "client" else {
            await signOut()
            throw AuthError.notAPatient
        }

        guard let patientId = me.patientId else {
            await signOut()
            throw AuthError.notAPatient
        }

        state = .authenticated(
            userId: me.userId,
            patientId: patientId,
            displayName: me.displayName ?? me.email
        )
    }

    // MARK: - Token Refresh

    func refreshTokens() async throws -> String {
        guard let token = refreshToken else {
            throw AuthError.noRefreshToken
        }

        let endpoint = Endpoint.refreshToken(token)
        let response: RefreshResponse = try await APIClient.shared.fetch(endpoint)

        try KeychainManager.shared.save(key: "somi.accessToken", value: response.accessToken)
        try KeychainManager.shared.save(key: "somi.refreshToken", value: response.refreshToken)

        return response.accessToken
    }

    // MARK: - Sign Out

    func signOut() async {
        if let token = refreshToken {
            try? await APIClient.shared.fetchVoid(Endpoint.logout(token))
        }
        KeychainManager.shared.delete(key: "somi.accessToken")
        KeychainManager.shared.delete(key: "somi.refreshToken")
        state = .unauthenticated
    }

    // MARK: - Restore Session

    func restoreSession() async {
        guard accessToken != nil else {
            state = .unauthenticated
            return
        }

        do {
            let me: MeResponse = try await APIClient.shared.fetch(Endpoint.getMe())
            guard me.role == "client", let patientId = me.patientId else {
                await signOut()
                return
            }
            state = .authenticated(
                userId: me.userId,
                patientId: patientId,
                displayName: me.displayName ?? me.email
            )
        } catch APIError.unauthorized {
            // Token expired, try refresh
            do {
                _ = try await refreshTokens()
                let me: MeResponse = try await APIClient.shared.fetch(Endpoint.getMe())
                guard me.role == "client", let patientId = me.patientId else {
                    await signOut()
                    return
                }
                state = .authenticated(
                    userId: me.userId,
                    patientId: patientId,
                    displayName: me.displayName ?? me.email
                )
            } catch {
                await signOut()
            }
        } catch {
            await signOut()
        }
    }
}
