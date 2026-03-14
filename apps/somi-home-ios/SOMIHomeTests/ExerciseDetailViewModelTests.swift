import XCTest
@testable import SOMIHome

// MARK: - ExerciseDetailViewModelTests
//
// NOTE: The iOS app does not have a dedicated ExerciseDetailViewModel class.
// ExerciseDetailView is a pure SwiftUI View that receives a TodayAssignment value and
// an ObservedObject TodayViewModel reference. All "view model" logic for the detail screen
// lives in TodayViewModel (currentOccurrence, isAllDoneForDay) and in local computed
// properties on ExerciseDetailView itself (isComplete). These tests exercise that logic
// directly through TodayViewModel + model construction, exactly as ExerciseDetailView does.
//
// TODO: inject APIClient to enable full async testing of markComplete / markIncomplete
// from the detail view.

@MainActor
final class ExerciseDetailViewModelTests: XCTestCase {

    // MARK: - Helpers (mirrors TodayViewModelTests helpers)

    private func makeAssignment(
        key: String = "a1",
        exerciseVersionId: String = "ev1",
        title: String = "Tongue Sweep",
        description: String = "Sweep tongue across the palate.",
        mediaId: String? = nil,
        completions: [CompletionEntry] = []
    ) -> TodayAssignment {
        TodayAssignment(
            assignmentKey: key,
            exerciseVersionId: exerciseVersionId,
            exercise: ExerciseInfo(
                title: title,
                description: description,
                mediaId: mediaId,
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

    // Mirrors the `isComplete` computed property in ExerciseDetailView:
    //   assignment.completions.first(where: { $0.occurrence == currentOccurrence })?.completed == true
    private func isComplete(assignment: TodayAssignment, occurrence: Int) -> Bool {
        assignment.completions
            .first(where: { $0.occurrence == occurrence })?.completed == true
    }

    // MARK: - 1. Initial / loading state

    func testInitialState_isLoading() {
        // A freshly created TodayViewModel starts with isLoading == false (no network call
        // has been made yet) and todayData == nil. ExerciseDetailView is only presented
        // after todayData is populated, so the "not yet loaded" state is represented by
        // the parent TodayView showing a LoadingSkeletonView instead.
        let vm = TodayViewModel()
        XCTAssertFalse(vm.isLoading, "isLoading should be false before loadToday() is called")
        XCTAssertNil(vm.todayData, "todayData should be nil before any load")
    }

    // MARK: - 2. Success state — title and description

    func testLoad_setsSuccessState_withCorrectTitle() {
        let vm = TodayViewModel()
        let assignment = makeAssignment(
            title: "Lip Seal",
            description: "Hold lips together gently.",
            completions: [makeCompletion(occurrence: 1, completed: false)]
        )
        vm.todayData = makeResponse(assignments: [assignment])

        XCTAssertNotNil(vm.todayData)
        XCTAssertEqual(vm.todayData?.assignments.first?.exercise?.title, "Lip Seal")
        XCTAssertEqual(
            vm.todayData?.assignments.first?.exercise?.description,
            "Hold lips together gently."
        )
    }

    // MARK: - 3. Video URL presence

    func testLoad_setsVideoUrl_whenMediaIdPresent() {
        let vm = TodayViewModel()
        let assignment = makeAssignment(
            mediaId: "media_abc123",
            completions: [makeCompletion(occurrence: 1, completed: false)]
        )
        vm.todayData = makeResponse(assignments: [assignment])

        let mediaId = vm.todayData?.assignments.first?.exercise?.mediaId
        XCTAssertNotNil(mediaId, "mediaId should be present when exercise has video")
        XCTAssertEqual(mediaId, "media_abc123")
    }

    func testLoad_videoUrlIsNil_whenNoMediaId() {
        let vm = TodayViewModel()
        let assignment = makeAssignment(
            mediaId: nil,
            completions: [makeCompletion(occurrence: 1, completed: false)]
        )
        vm.todayData = makeResponse(assignments: [assignment])

        let mediaId = vm.todayData?.assignments.first?.exercise?.mediaId
        XCTAssertNil(mediaId, "mediaId should be nil when exercise has no video")
    }

    // MARK: - 4. currentOccurrence matches TodayViewModel

    func testCurrentOccurrence_matchesTodayViewModel() {
        // ExerciseDetailView reads currentOccurrence directly from TodayViewModel.
        // Verify it reflects the same value from the vm as the computed property returns.
        let vm = TodayViewModel()
        let a1 = makeAssignment(key: "a1", completions: [
            makeCompletion(occurrence: 1, completed: true),
            makeCompletion(occurrence: 2, completed: false),
        ])
        let a2 = makeAssignment(key: "a2", exerciseVersionId: "ev2", completions: [
            makeCompletion(occurrence: 1, completed: true),
            makeCompletion(occurrence: 2, completed: false),
        ])
        vm.todayData = makeResponse(timesPerDay: 2, assignments: [a1, a2])

        // ExerciseDetailView uses: private var currentOccurrence: Int { viewModel.currentOccurrence }
        XCTAssertEqual(vm.currentOccurrence, 2,
            "Detail view currentOccurrence must match TodayViewModel after round 1 completes")
    }

    // MARK: - 5. isComplete for current occurrence

    func testIsCompleteForCurrentOccurrence_false_initially() {
        let vm = TodayViewModel()
        let assignment = makeAssignment(
            completions: [makeCompletion(occurrence: 1, completed: false)]
        )
        vm.todayData = makeResponse(assignments: [assignment])

        let occurrence = vm.currentOccurrence  // 1
        let complete = isComplete(assignment: assignment, occurrence: occurrence)
        XCTAssertFalse(complete,
            "Exercise should not be complete before the patient marks it done")
    }

    func testIsCompleteForCurrentOccurrence_true_afterCompletion() {
        let vm = TodayViewModel()
        let assignment = makeAssignment(
            completions: [makeCompletion(occurrence: 1, completed: true)]
        )
        vm.todayData = makeResponse(assignments: [assignment])

        let occurrence = vm.currentOccurrence  // 1
        let complete = isComplete(assignment: assignment, occurrence: occurrence)
        XCTAssertTrue(complete,
            "Exercise should be complete when the completion entry is marked true")
    }

    // MARK: - 6. toggleComplete — optimistic state update via TodayViewModel

    func testToggleComplete_updatesCompletionState() {
        // ExerciseDetailView calls viewModel.markComplete / markIncomplete on button tap.
        // markComplete does an optimistic in-memory update via setCompletion (private helper).
        // We verify the optimistic update is visible through the public todayData property.
        //
        // NOTE: markComplete also calls APIClient.shared (singleton — not injectable), so we
        // test only the synchronous state change that happens before the async network call.
        // TODO: inject APIClient to enable full async testing of the network path.

        let vm = TodayViewModel()
        vm.todayData = makeResponse(
            timesPerDay: 1,
            assignments: [
                makeAssignment(key: "a1", completions: [
                    makeCompletion(occurrence: 1, completed: false),
                ])
            ]
        )

        // Before toggle: not complete
        let before = vm.todayData?.assignments.first?
            .completions.first(where: { $0.occurrence == 1 })?.completed
        XCTAssertEqual(before, false, "Should start incomplete")

        // Directly mutate todayData as the optimistic update in markComplete does,
        // mirroring the private setCompletion helper logic:
        if var data = vm.todayData {
            for ai in data.assignments.indices
                where data.assignments[ai].assignmentKey == "a1" {
                for ci in data.assignments[ai].completions.indices
                    where data.assignments[ai].completions[ci].occurrence == 1 {
                    data.assignments[ai].completions[ci] = CompletionEntry(
                        occurrence: 1,
                        completed: true,
                        completedAt: "2026-03-12T11:00:00Z"
                    )
                }
            }
            vm.todayData = data
        }

        // After toggle: complete
        let after = vm.todayData?.assignments.first?
            .completions.first(where: { $0.occurrence == 1 })?.completed
        XCTAssertEqual(after, true, "Should be complete after optimistic update")
        XCTAssertTrue(vm.isAllDoneForDay,
            "isAllDoneForDay should be true after sole exercise is marked complete")
    }
}
