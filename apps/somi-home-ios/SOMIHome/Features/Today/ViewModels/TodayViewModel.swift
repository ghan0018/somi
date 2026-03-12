import Foundation
import Combine

@MainActor
final class TodayViewModel: ObservableObject {
    @Published var todayData: TodayViewResponse?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var pendingCount = 0

    private var cancellable: AnyCancellable?

    init() {
        cancellable = CompletionSyncManager.shared.$pendingCount
            .receive(on: DispatchQueue.main)
            .assign(to: \.pendingCount, on: self)
    }

    func loadToday() async {
        isLoading = true
        errorMessage = nil

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateLocal = formatter.string(from: Date())

        do {
            let response: TodayViewResponse = try await APIClient.shared.fetch(
                Endpoint.getToday(dateLocal: dateLocal)
            )
            todayData = response
        } catch APIError.networkUnavailable {
            errorMessage = "No internet connection."
        } catch {
            errorMessage = "Failed to load exercises."
        }

        isLoading = false
        CompletionSyncManager.shared.updatePendingCount()
    }

    func markComplete(
        assignmentKey: String,
        exerciseVersionId: String,
        occurrence: Int,
        sessionKey: String
    ) async {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateLocal = formatter.string(from: Date())
        let now = ISO8601DateFormatter().string(from: Date())

        // Optimistic update
        let optimisticEntry = CompletionEntry(occurrence: occurrence, completedAt: now)
        addCompletionOptimistically(
            sessionKey: sessionKey,
            assignmentKey: assignmentKey,
            entry: optimisticEntry
        )

        let endpoint = Endpoint.postCompletion(
            dateLocal: dateLocal,
            occurrence: occurrence,
            exerciseVersionId: exerciseVersionId,
            source: "mobile_ios",
            idempotencyKey: UUID().uuidString
        )

        do {
            try await APIClient.shared.fetchVoid(endpoint)
        } catch APIError.networkUnavailable {
            // Offline: enqueue locally, keep optimistic state
            LocalCompletionStore.shared.enqueue(
                dateLocal: dateLocal,
                occurrence: occurrence,
                exerciseVersionId: exerciseVersionId,
                source: "mobile_ios"
            )
            CompletionSyncManager.shared.updatePendingCount()
        } catch {
            // Revert optimistic update
            removeCompletionOptimistically(
                sessionKey: sessionKey,
                assignmentKey: assignmentKey,
                occurrence: occurrence
            )
            errorMessage = "Failed to record completion."
        }
    }

    func refresh() async {
        await CompletionSyncManager.shared.syncPendingCompletions()
        await loadToday()
    }

    // MARK: - Optimistic helpers

    private func addCompletionOptimistically(
        sessionKey: String,
        assignmentKey: String,
        entry: CompletionEntry
    ) {
        guard var data = todayData else { return }
        for si in data.sessions.indices where data.sessions[si].sessionKey == sessionKey {
            for ai in data.sessions[si].assignments.indices
                where data.sessions[si].assignments[ai].assignmentKey == assignmentKey {
                var assignment = data.sessions[si].assignments[ai]
                var completions = assignment.completions
                completions.append(entry)
                // Rebuild with updated completions
                assignment = TodayAssignment(
                    assignmentKey: assignment.assignmentKey,
                    exerciseVersionId: assignment.exerciseVersionId,
                    exercise: assignment.exercise,
                    paramsOverride: assignment.paramsOverride,
                    completions: completions
                )
                data.sessions[si].assignments[ai] = assignment
            }
        }
        todayData = data
    }

    private func removeCompletionOptimistically(
        sessionKey: String,
        assignmentKey: String,
        occurrence: Int
    ) {
        guard var data = todayData else { return }
        for si in data.sessions.indices where data.sessions[si].sessionKey == sessionKey {
            for ai in data.sessions[si].assignments.indices
                where data.sessions[si].assignments[ai].assignmentKey == assignmentKey {
                var assignment = data.sessions[si].assignments[ai]
                var completions = assignment.completions
                if let idx = completions.lastIndex(where: { $0.occurrence == occurrence }) {
                    completions.remove(at: idx)
                }
                assignment = TodayAssignment(
                    assignmentKey: assignment.assignmentKey,
                    exerciseVersionId: assignment.exerciseVersionId,
                    exercise: assignment.exercise,
                    paramsOverride: assignment.paramsOverride,
                    completions: completions
                )
                data.sessions[si].assignments[ai] = assignment
            }
        }
        todayData = data
    }
}
