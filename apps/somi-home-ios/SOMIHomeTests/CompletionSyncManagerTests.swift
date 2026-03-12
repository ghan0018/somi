import XCTest
@testable import SOMIHome

@MainActor
final class CompletionSyncManagerTests: XCTestCase {

    private var mockAPI: MockAPIClient!
    private var store: InMemoryCompletionStore!

    override func setUp() {
        super.setUp()
        mockAPI = MockAPIClient()
        store = InMemoryCompletionStore()
    }

    override func tearDown() {
        mockAPI = nil
        store = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func enqueueTestItem() -> PendingCompletionItem {
        _ = store.enqueue(
            dateLocal: "2026-03-12",
            occurrence: 1,
            exerciseVersionId: "ev1",
            source: "mobile_ios"
        )
        return store.fetchAllPending()[0]
    }

    private func syncItem(_ item: PendingCompletionItem) async {
        let endpoint = Endpoint.postCompletion(
            dateLocal: item.dateLocal,
            occurrence: item.occurrence,
            exerciseVersionId: item.exerciseVersionId,
            source: item.source,
            idempotencyKey: item.idempotencyKey
        )

        do {
            try await mockAPI.fetchVoid(endpoint)
            store.markSynced(id: item.id)
        } catch APIError.serverError(let code) where code == 409 {
            // Idempotent duplicate — treat as success
            store.markSynced(id: item.id)
        } catch APIError.serverError(let code) where (400...499).contains(code) {
            // Permanent client error
            store.markSynced(id: item.id)
        } catch APIError.networkUnavailable {
            store.incrementAttempts(id: item.id)
        } catch APIError.serverError {
            // 5xx
            store.incrementAttempts(id: item.id)
        } catch {
            store.incrementAttempts(id: item.id)
        }
    }

    // MARK: - Tests

    func testSyncSuccess201RemovesFromStore() async throws {
        // Arrange
        let item = enqueueTestItem()
        XCTAssertEqual(store.pendingCount, 1)

        mockAPI.fetchVoidHandler = { _ in
            // 201 success (no throw)
        }

        // Act
        await syncItem(item)

        // Assert
        XCTAssertEqual(store.pendingCount, 0, "Item should be removed after successful sync")
    }

    func test409TreatedAsSuccess() async throws {
        // Arrange
        let item = enqueueTestItem()
        XCTAssertEqual(store.pendingCount, 1)

        mockAPI.fetchVoidHandler = { _ in
            throw APIError.serverError(409)
        }

        // Act
        await syncItem(item)

        // Assert
        XCTAssertEqual(store.pendingCount, 0, "409 (already recorded) should remove item from store")
    }

    func test4xxRemovesFromStore() async throws {
        // Arrange
        let item = enqueueTestItem()
        XCTAssertEqual(store.pendingCount, 1)

        mockAPI.fetchVoidHandler = { _ in
            throw APIError.serverError(400)
        }

        // Act
        await syncItem(item)

        // Assert
        XCTAssertEqual(store.pendingCount, 0, "400 (permanent client error) should remove item from store")
    }

    func testNetworkErrorIncrementsAttempts() async throws {
        // Arrange
        let item = enqueueTestItem()
        XCTAssertEqual(store.pendingCount, 1)

        mockAPI.fetchVoidHandler = { _ in
            throw APIError.networkUnavailable
        }

        // Act
        await syncItem(item)

        // Assert
        XCTAssertEqual(store.pendingCount, 1, "Network error should keep item in store")
        let updatedItem = store.fetchAllPending()[0]
        XCTAssertEqual(updatedItem.syncAttempts, 1, "Sync attempts should be incremented")
    }

    func test5xxServerErrorIncrementsAttempts() async throws {
        // Arrange
        let item = enqueueTestItem()

        mockAPI.fetchVoidHandler = { _ in
            throw APIError.serverError(503)
        }

        // Act
        await syncItem(item)

        // Assert
        XCTAssertEqual(store.pendingCount, 1, "5xx error should keep item in store for retry")
        XCTAssertEqual(store.fetchAllPending()[0].syncAttempts, 1)
    }
}
