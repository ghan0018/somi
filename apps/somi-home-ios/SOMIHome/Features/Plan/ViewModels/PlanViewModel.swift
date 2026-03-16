import Foundation

@MainActor
final class PlanViewModel: ObservableObject {
    @Published var plan: TreatmentPlan?
    @Published var isLoading = false
    @Published var isEmpty = false
    @Published var errorMessage: String?

    func loadPlan() async {
        isLoading = true
        errorMessage = nil
        isEmpty = false

        do {
            let response: TreatmentPlan = try await APIClient.shared.fetch(Endpoint.getPlan())
            plan = response
        } catch APIError.serverError(404) {
            isEmpty = true
            plan = nil
        } catch APIError.networkUnavailable {
            errorMessage = "No internet connection."
        } catch {
            errorMessage = "Failed to load treatment plan."
        }

        isLoading = false
    }
}
