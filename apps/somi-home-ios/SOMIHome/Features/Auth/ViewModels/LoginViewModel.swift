import Foundation

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    func signIn() async {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter your email and password."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await AuthManager.shared.login(email: trimmedEmail, password: password)
        } catch APIError.unauthorized {
            errorMessage = "Incorrect email or password."
        } catch APIError.networkUnavailable {
            errorMessage = "No internet connection. Please try again."
        } catch AuthError.notAPatient {
            errorMessage = "SOMI Home is for patients only. Please use the SOMI Clinic web app."
        } catch {
            errorMessage = "Something went wrong. Please try again."
        }

        isLoading = false
    }
}
