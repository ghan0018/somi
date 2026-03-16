import Foundation
import Combine

@MainActor
final class TodayViewModel: ObservableObject {
    @Published var todayData: TodayViewResponse?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var pendingCount = 0

    /// Set to true (briefly) when the patient just completed a full round but still
    /// has more rounds left today. TodayView presents a congrats sheet then resets it.
    @Published var showCongratsModal = false

    private var cancellable: AnyCancellable?

    init() {
        cancellable = CompletionSyncManager.shared.$pendingCount
            .receive(on: DispatchQueue.main)
            .assign(to: \.pendingCount, on: self)
    }

    // MARK: - Computed helpers

    /// How many full rounds have been completed today (all exercises done for that occurrence).
    var completedRoundsToday: Int {
        guard let data = todayData, !data.assignments.isEmpty else { return 0 }
        var count = 0
        for round in 1...data.timesPerDay {
            let allDone = data.assignments.allSatisfy { assignment in
                assignment.completions.first { $0.occurrence == round }?.completed == true
            }
            if allDone { count += 1 }
        }
        return count
    }

    /// True when every occurrence of every exercise is marked complete.
    var isAllDoneForDay: Bool {
        guard let data = todayData, !data.assignments.isEmpty else { return false }
        return completedRoundsToday == data.timesPerDay
    }

    /// The active round: the first incomplete occurrence, or timesPerDay when all rounds are done.
    var currentOccurrence: Int {
        guard let data = todayData, !data.assignments.isEmpty else { return 1 }
        for round in 1...data.timesPerDay {
            let allDone = data.assignments.allSatisfy { assignment in
                assignment.completions.first { $0.occurrence == round }?.completed == true
            }
            if !allDone { return round }
        }
        return data.timesPerDay
    }

    // MARK: - Load

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
        } catch APIError.serverError(404) {
            // No published treatment plan yet — show friendly empty state
            todayData = nil
        } catch APIError.networkUnavailable {
            errorMessage = "No internet connection."
        } catch {
            errorMessage = "Failed to load exercises."
        }

        isLoading = false
        CompletionSyncManager.shared.updatePendingCount()
    }

    // MARK: - Complete / Incomplete

    func markComplete(assignmentKey: String, exerciseVersionId: String, occurrence: Int) async {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateLocal = formatter.string(from: Date())

        let prevRounds = completedRoundsToday

        // Optimistic update
        setCompletion(assignmentKey: assignmentKey, occurrence: occurrence, completed: true)

        // Detect round completion
        let newRounds = completedRoundsToday
        if newRounds > prevRounds, let data = todayData {
            if newRounds < data.timesPerDay {
                // Completed a round, but more to go — show congrats
                showCongratsModal = true
            }
            // If newRounds == timesPerDay the TodayView shows the all-done state automatically
        }

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
            // Offline: keep optimistic state, enqueue for later sync
            LocalCompletionStore.shared.enqueue(
                dateLocal: dateLocal,
                occurrence: occurrence,
                exerciseVersionId: exerciseVersionId,
                source: "mobile_ios"
            )
            CompletionSyncManager.shared.updatePendingCount()
        } catch {
            // Revert optimistic update
            setCompletion(assignmentKey: assignmentKey, occurrence: occurrence, completed: false)
            errorMessage = "Failed to record completion."
        }
    }

    func markIncomplete(assignmentKey: String, exerciseVersionId: String, occurrence: Int) async {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateLocal = formatter.string(from: Date())

        // Optimistic update
        setCompletion(assignmentKey: assignmentKey, occurrence: occurrence, completed: false)

        let endpoint = Endpoint.deleteCompletion(
            dateLocal: dateLocal,
            occurrence: occurrence,
            exerciseVersionId: exerciseVersionId
        )

        do {
            try await APIClient.shared.fetchVoid(endpoint)
        } catch APIError.networkUnavailable {
            // Revert — unmark requires connectivity
            setCompletion(assignmentKey: assignmentKey, occurrence: occurrence, completed: true)
            errorMessage = "Cannot undo completion while offline."
        } catch {
            // Revert on failure
            setCompletion(assignmentKey: assignmentKey, occurrence: occurrence, completed: true)
        }
    }

    func refresh() async {
        await CompletionSyncManager.shared.syncPendingCompletions()
        await loadToday()
    }

    // MARK: - Optimistic helpers

    private func setCompletion(assignmentKey: String, occurrence: Int, completed: Bool) {
        guard var data = todayData else { return }
        for ai in data.assignments.indices
            where data.assignments[ai].assignmentKey == assignmentKey {
            for ci in data.assignments[ai].completions.indices
                where data.assignments[ai].completions[ci].occurrence == occurrence {
                data.assignments[ai].completions[ci] = CompletionEntry(
                    occurrence: occurrence,
                    completed: completed,
                    completedAt: completed ? ISO8601DateFormatter().string(from: Date()) : nil
                )
            }
        }
        todayData = data
    }
}
