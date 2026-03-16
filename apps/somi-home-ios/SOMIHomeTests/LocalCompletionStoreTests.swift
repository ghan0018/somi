import XCTest
@testable import SOMIHome

/// In-memory mock of LocalCompletionStore for unit testing (avoids Core Data dependency)
final class InMemoryCompletionStore {
    private var items: [PendingCompletionItem] = []

    @discardableResult
    func enqueue(dateLocal: String, occurrence: Int, exerciseVersionId: String, source: String) -> String {
        let id = UUID().uuidString
        let idempotencyKey = UUID().uuidString
        let item = PendingCompletionItem(
            id: id,
            dateLocal: dateLocal,
            occurrence: occurrence,
            exerciseVersionId: exerciseVersionId,
            idempotencyKey: idempotencyKey,
            source: source,
            syncAttempts: 0
        )
        items.append(item)
        return idempotencyKey
    }

    func fetchAllPending() -> [PendingCompletionItem] {
        items
    }

    func markSynced(id: String) {
        items.removeAll { $0.id == id }
    }

    func incrementAttempts(id: String) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        let item = items[index]
        items[index] = PendingCompletionItem(
            id: item.id,
            dateLocal: item.dateLocal,
            occurrence: item.occurrence,
            exerciseVersionId: item.exerciseVersionId,
            idempotencyKey: item.idempotencyKey,
            source: item.source,
            syncAttempts: item.syncAttempts + 1
        )
    }

    var pendingCount: Int { items.count }
}

final class LocalCompletionStoreTests: XCTestCase {

    var sut: InMemoryCompletionStore!

    override func setUp() {
        super.setUp()
        sut = InMemoryCompletionStore()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func testEnqueueCreatesItemWithIdempotencyKey() {
        // Act
        let key = sut.enqueue(
            dateLocal: "2026-03-12",
            occurrence: 1,
            exerciseVersionId: "ev1",
            source: "mobile_ios"
        )

        // Assert
        XCTAssertFalse(key.isEmpty, "Idempotency key should not be empty")
        XCTAssertEqual(sut.pendingCount, 1)

        let items = sut.fetchAllPending()
        XCTAssertEqual(items[0].dateLocal, "2026-03-12")
        XCTAssertEqual(items[0].occurrence, 1)
        XCTAssertEqual(items[0].exerciseVersionId, "ev1")
        XCTAssertEqual(items[0].source, "mobile_ios")
        XCTAssertEqual(items[0].idempotencyKey, key)
    }

    func testEnqueueReturnsDifferentKeysForDifferentCompletions() {
        // Act
        let key1 = sut.enqueue(dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev1", source: "mobile_ios")
        let key2 = sut.enqueue(dateLocal: "2026-03-12", occurrence: 2, exerciseVersionId: "ev1", source: "mobile_ios")
        let key3 = sut.enqueue(dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev2", source: "mobile_ios")

        // Assert
        XCTAssertNotEqual(key1, key2, "Different completions should have different idempotency keys")
        XCTAssertNotEqual(key1, key3)
        XCTAssertNotEqual(key2, key3)
        XCTAssertEqual(sut.pendingCount, 3)
    }

    func testMarkSyncedDeletesItem() {
        // Arrange
        _ = sut.enqueue(dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev1", source: "mobile_ios")
        let items = sut.fetchAllPending()
        XCTAssertEqual(items.count, 1)

        // Act
        sut.markSynced(id: items[0].id)

        // Assert
        XCTAssertEqual(sut.pendingCount, 0)
        XCTAssertTrue(sut.fetchAllPending().isEmpty)
    }

    func testIncrementAttemptsIncreasesCount() {
        // Arrange
        _ = sut.enqueue(dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev1", source: "mobile_ios")
        let itemId = sut.fetchAllPending()[0].id

        // Act
        sut.incrementAttempts(id: itemId)
        sut.incrementAttempts(id: itemId)

        // Assert
        let item = sut.fetchAllPending()[0]
        XCTAssertEqual(item.syncAttempts, 2)
    }

    func testFetchAllPendingReturnsPendingItems() {
        // Arrange
        _ = sut.enqueue(dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev1", source: "mobile_ios")
        _ = sut.enqueue(dateLocal: "2026-03-12", occurrence: 2, exerciseVersionId: "ev1", source: "mobile_ios")
        _ = sut.enqueue(dateLocal: "2026-03-13", occurrence: 1, exerciseVersionId: "ev2", source: "mobile_ios")

        // Act
        let items = sut.fetchAllPending()

        // Assert
        XCTAssertEqual(items.count, 3)
        XCTAssertEqual(items[0].occurrence, 1)
        XCTAssertEqual(items[1].occurrence, 2)
        XCTAssertEqual(items[2].exerciseVersionId, "ev2")
    }
}
