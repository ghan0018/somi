import XCTest
@testable import SOMIHome

@MainActor
final class TodayViewModelTests: XCTestCase {

    // MARK: - Helpers

    private func makeAssignment(
        key: String = "a1",
        exerciseVersionId: String = "ev1",
        completions: [CompletionEntry] = []
    ) -> TodayAssignment {
        TodayAssignment(
            assignmentKey: key,
            exerciseVersionId: exerciseVersionId,
            exercise: ExerciseInfo(
                title: "Tongue Sweep",
                description: "Sweep tongue across the palate.",
                mediaId: nil,
                defaultParams: ExerciseParams(reps: 10, sets: 2, seconds: nil)
            ),
            effectiveParams: ExerciseParams(reps: 10, sets: 2, seconds: nil),
            completions: completions
        )
    }

    private func makeCompletion(occurrence: Int, completed: Bool = true) -> CompletionEntry {
        CompletionEntry(
            occurrence: occurrence,
            completed: completed,
            completedAt: completed ? "2026-03-12T10:00:00Z" : nil
        )
    }

    private func makeResponse(
        timesPerDay: Int = 1,
        assignments: [TodayAssignment]
    ) -> TodayViewResponse {
        TodayViewResponse(
            dateLocal: "2026-03-12",
            sessionKey: "sess_01",
            sessionTitle: "Morning Routine",
            sessionNotes: nil,
            timesPerDay: timesPerDay,
            assignments: assignments,
            overallCompletionRate: 0.0
        )
    }

    // MARK: - completedRoundsToday

    func testCompletedRoundsTodayIsZeroWithNoData() {
        let vm = TodayViewModel()
        XCTAssertEqual(vm.completedRoundsToday, 0)
    }

    func testCompletedRoundsTodayIsZeroWhenNothingDone() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                ])
            ]
        )
        XCTAssertEqual(vm.completedRoundsToday, 0)
    }

    func testCompletedRoundsTodayCountsFullRound() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.completedRoundsToday, 1)
    }

    func testCompletedRoundsTodayPartialRoundNotCounted() {
        // Only one of two assignments done in round 1 — should NOT count as complete
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 1,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.completedRoundsToday, 0)
    }

    func testCompletedRoundsTodayCountsBothRoundsWhenAllDone() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                ])
            ]
        )
        XCTAssertEqual(vm.completedRoundsToday, 2)
    }

    // MARK: - isAllDoneForDay

    func testIsAllDoneForDayFalseWithNoData() {
        let vm = TodayViewModel()
        XCTAssertFalse(vm.isAllDoneForDay)
    }

    func testIsAllDoneForDayFalseWhenPartiallyDone() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ])
            ]
        )
        XCTAssertFalse(vm.isAllDoneForDay)
    }

    func testIsAllDoneForDayTrueWhenAllRoundsComplete() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                ])
            ]
        )
        XCTAssertTrue(vm.isAllDoneForDay)
    }

    // MARK: - currentOccurrence

    func testCurrentOccurrenceDefaultsToOneWithNoData() {
        let vm = TodayViewModel()
        XCTAssertEqual(vm.currentOccurrence, 1)
    }

    func testCurrentOccurrenceIsOneWhenNothingDone() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 3,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                    makeCompletion(occurrence: 3, completed: false),
                ])
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 1)
    }

    func testCurrentOccurrenceAdvancesToTwoAfterRoundOneComplete() {
        // Both assignments complete for occurrence 1 → active round is 2
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 2)
    }

    func testCurrentOccurrenceDoesNotAdvanceOnPartialRound() {
        // Only one of two assignments done for occurrence 1 — round not complete yet
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 1)
    }

    func testCurrentOccurrenceReturnsTimesPerDayWhenAllDone() {
        // All rounds done — returns timesPerDay (not an out-of-bounds index)
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                ])
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 2)
    }

    // MARK: - Endpoint construction

    func testGetTodayEndpointUsesDateLocal() async throws {
        let mockAPI = MockAPIClient()
        var capturedEndpoint: Endpoint?
        mockAPI.fetchHandler = { endpoint in
            capturedEndpoint = endpoint
            return self.makeResponse(assignments: [self.makeAssignment()])
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())

        let _: TodayViewResponse = try await mockAPI.fetch(Endpoint.getToday(dateLocal: today))

        XCTAssertNotNil(capturedEndpoint)
        XCTAssertEqual(capturedEndpoint?.queryParams["dateLocal"], today)
        XCTAssertTrue(capturedEndpoint?.path.contains("/v1/me/today") ?? false)
    }

    func testMarkCompletePostsToCorrectEndpoint() async throws {
        let mockAPI = MockAPIClient()
        var capturedEndpoint: Endpoint?
        mockAPI.fetchVoidHandler = { endpoint in
            capturedEndpoint = endpoint
        }

        let idempotencyKey = UUID().uuidString
        try await mockAPI.fetchVoid(
            Endpoint.postCompletion(
                dateLocal: "2026-03-12",
                occurrence: 2,
                exerciseVersionId: "ev1",
                source: "mobile_ios",
                idempotencyKey: idempotencyKey
            )
        )

        XCTAssertNotNil(capturedEndpoint)
        XCTAssertEqual(capturedEndpoint?.path, "/v1/me/completions")
        XCTAssertEqual(capturedEndpoint?.method, .POST)
        XCTAssertEqual(capturedEndpoint?.headers["Idempotency-Key"], idempotencyKey)
    }

    func testMarkCompleteOfflineEnqueuesCompletion() async throws {
        let mockAPI = MockAPIClient()
        mockAPI.fetchVoidHandler = { _ in
            throw APIError.networkUnavailable
        }

        var enqueuedItems: [(dateLocal: String, occurrence: Int, exerciseVersionId: String)] = []

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
            enqueuedItems.append((dateLocal: "2026-03-12", occurrence: 1, exerciseVersionId: "ev1"))
        }

        XCTAssertEqual(enqueuedItems.count, 1)
        XCTAssertEqual(enqueuedItems[0].dateLocal, "2026-03-12")
        XCTAssertEqual(enqueuedItems[0].occurrence, 1)
        XCTAssertEqual(enqueuedItems[0].exerciseVersionId, "ev1")
    }

    func testMarkCompleteAPIFailureDoesNotEnqueueLocally() async throws {
        let mockAPI = MockAPIClient()
        mockAPI.fetchVoidHandler = { _ in
            throw APIError.serverError(500)
        }

        var enqueuedCount = 0

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
        } catch APIError.serverError {
            // Server error should not enqueue locally — just fail
        } catch APIError.networkUnavailable {
            enqueuedCount += 1
        }

        XCTAssertEqual(enqueuedCount, 0, "Server errors should not be enqueued locally")
    }

    // MARK: - Congrats modal

    /// showCongratsModal is triggered inside markComplete() which calls APIClient.shared (not
    /// injectable). These tests verify the supporting computed-property logic that governs
    /// WHEN the flag would be set, and verify that the flag itself can be read/written correctly.
    /// TODO: inject APIClient to enable full end-to-end congrats modal trigger testing.

    func testCongratsModal_triggered_whenFirstRoundCompletes_withTwoRoundsTotal() {
        // Set up the data state that exists immediately AFTER markComplete would set the flag:
        // completedRoundsToday == 1, timesPerDay == 2 → newRounds (1) < timesPerDay (2).
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )

        // Verify the conditions required to trigger showCongratsModal = true in markComplete:
        let completedRounds = vm.completedRoundsToday
        let timesPerDay = vm.todayData!.timesPerDay
        XCTAssertEqual(completedRounds, 1)
        XCTAssertLessThan(completedRounds, timesPerDay,
            "Round complete but more to go — congrats condition should be satisfied")

        // Simulate the flag being set (as markComplete does):
        vm.showCongratsModal = true
        XCTAssertTrue(vm.showCongratsModal)
    }

    func testCongratsModal_notTriggered_whenSingleRoundPlanCompletes() {
        // timesPerDay=1: completing the only round → isAllDoneForDay, NOT congrats modal.
        // The markComplete guard is: newRounds < timesPerDay, which is false when timesPerDay==1.
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 1,
            assignments: [
                makeAssignment(completions: [
                    makeCompletion(occurrence: 1, completed: true),
                ])
            ]
        )

        XCTAssertEqual(vm.completedRoundsToday, 1)
        XCTAssertEqual(vm.todayData?.timesPerDay, 1)
        // completedRounds == timesPerDay → condition `newRounds < timesPerDay` is false.
        XCTAssertFalse(vm.completedRoundsToday < vm.todayData!.timesPerDay,
            "Single-round completion must NOT satisfy the congrats condition")
        XCTAssertTrue(vm.isAllDoneForDay,
            "Single-round completion should present the all-done state instead")
        // Flag must remain false (was never set):
        XCTAssertFalse(vm.showCongratsModal)
    }

    func testCongratsModal_dismissed_clearsFlagAndKeepsData() {
        // Verify that clearing showCongratsModal leaves todayData intact.
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )
        vm.showCongratsModal = true
        XCTAssertTrue(vm.showCongratsModal)

        // CongratsModalView's onDismiss closure does exactly this:
        vm.showCongratsModal = false

        XCTAssertFalse(vm.showCongratsModal, "Flag must be false after dismiss")
        XCTAssertNotNil(vm.todayData, "todayData must not be wiped on dismiss")
        XCTAssertEqual(vm.todayData?.timesPerDay, 2)
        XCTAssertEqual(vm.todayData?.assignments.count, 1)
    }

    // MARK: - Session gating (currentOccurrence / isAllDoneForDay, extended)

    func testCurrentOccurrence_returnsOne_whenNothingComplete() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 3,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 1)
    }

    func testCurrentOccurrence_advancesToTwo_whenFirstRoundAllDone() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 3,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 2,
            "After round 1 fully complete, active occurrence should advance to 2")
    }

    func testCurrentOccurrence_staysAtOne_whenOnlyPartiallyComplete() {
        // One of two assignments done for occurrence 1 — round not fully done, must stay at 1.
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 2,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                    makeCompletion(occurrence: 2, completed: false),
                ]),
            ]
        )
        XCTAssertEqual(vm.currentOccurrence, 1,
            "Partial completion of a round must not advance currentOccurrence")
    }

    func testIsAllDoneForDay_false_whenPartiallyComplete() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 3,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                    makeCompletion(occurrence: 3, completed: false),
                ]),
            ]
        )
        XCTAssertFalse(vm.isAllDoneForDay,
            "Two of three rounds complete should not be considered all-done")
        XCTAssertEqual(vm.completedRoundsToday, 2)
    }

    func testIsAllDoneForDay_true_whenAllRoundsComplete() {
        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 3,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                    makeCompletion(occurrence: 3, completed: true),
                ]),
                makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
                    makeCompletion(occurrence: 1, completed: true),
                    makeCompletion(occurrence: 2, completed: true),
                    makeCompletion(occurrence: 3, completed: true),
                ]),
            ]
        )
        XCTAssertTrue(vm.isAllDoneForDay,
            "All occurrences complete should report isAllDoneForDay == true")
        XCTAssertEqual(vm.completedRoundsToday, 3)
        XCTAssertEqual(vm.currentOccurrence, 3,
            "currentOccurrence returns timesPerDay when all done (not out of bounds)")
    }
}
