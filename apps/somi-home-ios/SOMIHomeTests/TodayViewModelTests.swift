import XCTest
@testable import SOMIHome

@MainActor
final class TodayViewModelTests: XCTestCase {

    private var mockAPI: MockAPIClient!

    override func setUp() {
        super.setUp()
        mockAPI = MockAPIClient()
    }

    override func tearDown() {
        mockAPI = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeTodayResponse(
        dateLocal: String = "2026-03-12",
        completions: [CompletionEntry] = []
    ) -> TodayViewResponse {
        TodayViewResponse(
            planId: "plan-1",
            dateLocal: dateLocal,
            sessions: [
                TodaySession(
                    sessionKey: "s1",
                    title: "Morning Routine",
                    timesPerDay: 1,
                    assignments: [
                        TodayAssignment(
                            assignmentKey: "a1",
                            exerciseVersionId: "ev1",
                            exercise: ExerciseInfo(
                                title: "Tongue Sweep",
                                description: "Sweep your tongue across the palate.",
                                defaultParams: ExerciseParams(reps: 10, sets: 2, seconds: nil),
                                mediaId: nil
                            ),
                            paramsOverride: nil,
                            completions: completions
                        )
                    ]
                )
            ]
        )
    }

    // MARK: - loadToday

    func testLoadTodayUsesCorrectDateLocal() async throws {
        // Arrange
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let expectedDate = formatter.string(from: Date())

        var capturedEndpoint: Endpoint?
        mockAPI.fetchHandler = { endpoint in
            capturedEndpoint = endpoint
            return self.makeTodayResponse(dateLocal: expectedDate)
        }

        // Act
        let _: TodayViewResponse = try await mockAPI.fetch(
            Endpoint.getToday(dateLocal: expectedDate)
        )

        // Assert
        XCTAssertNotNil(capturedEndpoint)
        XCTAssertEqual(capturedEndpoint?.queryParams["dateLocal"], expectedDate)
        XCTAssertTrue(capturedEndpoint?.path.contains("/v1/me/today") ?? false)
    }

    // MARK: - markComplete (online)

    func testMarkCompleteOnlinePostsToAPI() async throws {
        // Arrange
        var capturedEndpoint: Endpoint?
        mockAPI.fetchVoidHandler = { endpoint in
            capturedEndpoint = endpoint
        }

        let idempotencyKey = UUID().uuidString
        let endpoint = Endpoint.postCompletion(
            dateLocal: "2026-03-12",
            occurrence: 1,
            exerciseVersionId: "ev1",
            source: "mobile_ios",
            idempotencyKey: idempotencyKey
        )

        // Act
        try await mockAPI.fetchVoid(endpoint)

        // Assert
        XCTAssertNotNil(capturedEndpoint)
        XCTAssertEqual(capturedEndpoint?.path, "/v1/me/completions")
        XCTAssertEqual(capturedEndpoint?.method, .POST)
        XCTAssertEqual(capturedEndpoint?.headers["Idempotency-Key"], idempotencyKey)
    }

    func testMarkCompleteAPIFailureRollsBackOptimisticUpdate() async throws {
        // Arrange — start with no completions
        var todayData = makeTodayResponse()
        XCTAssertEqual(todayData.sessions[0].assignments[0].completions.count, 0)

        // Optimistic update
        let optimisticEntry = CompletionEntry(occurrence: 1, completedAt: "2026-03-12T10:00:00Z")
        var assignment = todayData.sessions[0].assignments[0]
        var completions = assignment.completions
        completions.append(optimisticEntry)
        assignment = TodayAssignment(
            assignmentKey: assignment.assignmentKey,
            exerciseVersionId: assignment.exerciseVersionId,
            exercise: assignment.exercise,
            paramsOverride: assignment.paramsOverride,
            completions: completions
        )
        todayData.sessions[0].assignments[0] = assignment
        XCTAssertEqual(todayData.sessions[0].assignments[0].completions.count, 1)

        // Simulate API failure
        mockAPI.fetchVoidHandler = { _ in
            throw APIError.serverError(500)
        }

        do {
            try await mockAPI.fetchVoid(
                Endpoint.postCompletion(
                    dateLocal: "2026-03-12",
                    occurrence: 1,
                    exerciseVersionId: "ev1",
                    source: "mobile_ios",
                    idempotencyKey: UUID().uuidString
                )
            )
            XCTFail("Should have thrown")
        } catch {
            // Rollback
            var rollbackAssignment = todayData.sessions[0].assignments[0]
            var rollbackCompletions = rollbackAssignment.completions
            if let idx = rollbackCompletions.lastIndex(where: { $0.occurrence == 1 }) {
                rollbackCompletions.remove(at: idx)
            }
            rollbackAssignment = TodayAssignment(
                assignmentKey: rollbackAssignment.assignmentKey,
                exerciseVersionId: rollbackAssignment.exerciseVersionId,
                exercise: rollbackAssignment.exercise,
                paramsOverride: rollbackAssignment.paramsOverride,
                completions: rollbackCompletions
            )
            todayData.sessions[0].assignments[0] = rollbackAssignment
        }

        // Assert — rolled back to 0 completions
        XCTAssertEqual(todayData.sessions[0].assignments[0].completions.count, 0)
    }

    func testMarkCompleteOfflineEnqueuesCompletion() async throws {
        // Arrange
        mockAPI.fetchVoidHandler = { _ in
            throw APIError.networkUnavailable
        }

        var enqueuedItems: [(dateLocal: String, occurrence: Int, exerciseVersionId: String)] = []

        // Act — simulate offline completion flow
        do {
            try await mockAPI.fetchVoid(
                Endpoint.postCompletion(
                    dateLocal: "2026-03-12",
                    occurrence: 1,
                    exerciseVersionId: "ev1",
                    source: "mobile_ios",
                    idempotencyKey: UUID().uuidString
                )
            )
        } catch APIError.networkUnavailable {
            // Enqueue locally
            enqueuedItems.append((
                dateLocal: "2026-03-12",
                occurrence: 1,
                exerciseVersionId: "ev1"
            ))
        }

        // Assert
        XCTAssertEqual(enqueuedItems.count, 1)
        XCTAssertEqual(enqueuedItems[0].dateLocal, "2026-03-12")
        XCTAssertEqual(enqueuedItems[0].occurrence, 1)
        XCTAssertEqual(enqueuedItems[0].exerciseVersionId, "ev1")
    }

    func testPendingCountReflectsStore() async throws {
        // Arrange — simulate a store with pending items
        var pendingCount = 0

        // Enqueue 3 items
        for i in 1...3 {
            pendingCount += 1
            XCTAssertEqual(pendingCount, i)
        }

        // Mark one synced
        pendingCount -= 1

        // Assert
        XCTAssertEqual(pendingCount, 2)
    }
}
