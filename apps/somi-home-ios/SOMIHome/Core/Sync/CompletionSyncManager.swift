import Foundation
import Network

@MainActor
final class CompletionSyncManager: ObservableObject {
    static let shared = CompletionSyncManager()

    @Published var pendingCount: Int = 0

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.somi.home.networkMonitor")
    private var hasStarted = false

    private init() {}

    func startMonitoring() {
        guard !hasStarted else { return }
        hasStarted = true
        updatePendingCount()

        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor [weak self] in
                await self?.syncPendingCompletions()
            }
        }
        monitor.start(queue: monitorQueue)
    }

    func syncPendingCompletions() async {
        let items = LocalCompletionStore.shared.fetchAllPending()
        guard !items.isEmpty else { return }

        for item in items {
            let endpoint = Endpoint.postCompletion(
                dateLocal: item.dateLocal,
                occurrence: item.occurrence,
                exerciseVersionId: item.exerciseVersionId,
                source: item.source,
                idempotencyKey: item.idempotencyKey
            )

            do {
                try await APIClient.shared.fetchVoid(endpoint)
                LocalCompletionStore.shared.markSynced(id: item.id)
            } catch APIError.serverError(let code) where code == 409 {
                // Already recorded (idempotent duplicate)
                LocalCompletionStore.shared.markSynced(id: item.id)
            } catch APIError.serverError(let code) where (400...499).contains(code) {
                // Permanent client error, won't succeed on retry
                LocalCompletionStore.shared.markSynced(id: item.id)
            } catch APIError.networkUnavailable {
                LocalCompletionStore.shared.incrementAttempts(id: item.id)
            } catch APIError.serverError {
                // 5xx
                LocalCompletionStore.shared.incrementAttempts(id: item.id)
            } catch {
                LocalCompletionStore.shared.incrementAttempts(id: item.id)
            }
        }

        updatePendingCount()
    }

    func updatePendingCount() {
        pendingCount = LocalCompletionStore.shared.pendingCount
    }
}
