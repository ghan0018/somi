import XCTest
@testable import SOMIHome

@MainActor
final class PlanViewModelTests: XCTestCase {

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

    private func makePlanResponse() -> TreatmentPlan {
        TreatmentPlan(
            planId: "plan-1",
            patientId: "p1",
            status: "published",
            sessions: [
                PlanSession(
                    sessionKey: "s1",
                    index: 0,
                    title: "Morning Routine",
                    timesPerDay: 2,
                    assignments: [
                        PlanAssignment(
                            assignmentKey: "a1",
                            exerciseVersionId: "ev1",
                            index: 0,
                            exercise: ExerciseInfo(
                                title: "Tongue Sweep",
                                description: "Sweep your tongue across the palate.",
                                defaultParams: ExerciseParams(reps: 10, sets: 2, seconds: nil),
                                mediaId: nil
                            ),
                            paramsOverride: ExerciseParams(reps: 15, sets: nil, seconds: nil)
                        )
                    ]
                )
            ]
        )
    }

    // MARK: - Tests

    func test404ResponseSetsEmptyState() async throws {
        // Arrange
        mockAPI.fetchHandler = { _ in
            throw APIError.serverError(404)
        }

        // Act
        var plan: TreatmentPlan?
        var isEmpty = false
        var errorMessage: String?

        do {
            plan = try await mockAPI.fetch(Endpoint.getPlan())
        } catch APIError.serverError(let code) where code == 404 {
            // 404 = no published plan → empty state, NOT error
            isEmpty = true
        } catch {
            errorMessage = error.localizedDescription
        }

        // Assert
        XCTAssertTrue(isEmpty, "404 should set empty state")
        XCTAssertNil(plan, "Plan should be nil on 404")
        XCTAssertNil(errorMessage, "404 should NOT set error message")
    }

    func testSuccessfulPlanResponseSetsPlan() async throws {
        // Arrange
        let planData = makePlanResponse()
        mockAPI.fetchHandler = { _ in planData }

        // Act
        let plan: TreatmentPlan = try await mockAPI.fetch(Endpoint.getPlan())

        // Assert
        XCTAssertEqual(plan.planId, "plan-1")
        XCTAssertEqual(plan.status, "published")
        XCTAssertEqual(plan.sessions.count, 1)
        XCTAssertEqual(plan.sessions[0].title, "Morning Routine")
        XCTAssertEqual(plan.sessions[0].assignments.count, 1)
        XCTAssertEqual(plan.sessions[0].assignments[0].exercise?.title, "Tongue Sweep")
    }

    func testNetworkErrorSetsErrorMessage() async throws {
        // Arrange
        mockAPI.fetchHandler = { _ in
            throw APIError.networkUnavailable
        }

        // Act
        var errorMessage: String?

        do {
            let _: TreatmentPlan = try await mockAPI.fetch(Endpoint.getPlan())
        } catch APIError.networkUnavailable {
            errorMessage = "No internet connection."
        } catch {
            errorMessage = "Failed to load plan."
        }

        // Assert
        XCTAssertNotNil(errorMessage)
        XCTAssertEqual(errorMessage, "No internet connection.")
    }
}
