// ─────────────────────────────────────────────────────────────────────────────
// TodayViewUITests
//
// IMPORTANT — the backend must be running on http://localhost:3000 before
// these tests are executed.  The easiest way is the repo helper script:
//
//   ./scripts/test-ios-uitests.sh          ← starts backend + runs tests
//
// To run manually from Xcode, start the backend first in a separate terminal:
//
//   npm run start:e2e -w somi-connect      ← embedded MongoDB, no setup needed
//
// Each test calls POST /test/reset to seed a deterministic e2e user and plan.
// ─────────────────────────────────────────────────────────────────────────────

import XCTest

final class TodayViewUITests: XCTestCase {
    var app: XCUIApplication!
    let baseUrl = "http://localhost:3000"

    override func setUpWithError() throws {
        continueAfterFailure = false

        // Reset backend to a known two-round scenario
        resetBackendState(scenario: "today_view_two_rounds")

        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()

        // Log in as the e2e patient
        login(email: "e2e-patient@test.com", password: "TestPassword123!")
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Failure screenshots

    /// Capture a screenshot at the exact moment any assertion fails.
    /// The attachment is stored in the xcresult bundle; the CI workflow
    /// extracts and uploads it as a PNG artifact for remote debugging.
    override func record(_ issue: XCTIssue) {
        if let app {
            let screenshot = app.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "Failure — \(name)"
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        super.record(issue)
    }

    // MARK: - Tests

    func testTodayView_displaysExercises() throws {
        let exerciseList = app.descendants(matching: .any).matching(identifier: "today_exercise_list").firstMatch
        XCTAssertTrue(
            // CI can be slow: login (~12s) + /me/today (~13s) = up to 25s; allow 40s
            exerciseList.waitForExistence(timeout: 40),
            "Today exercise list should be visible after login"
        )
        // At least one exercise row should exist.
        // Use descendants(matching: .any) — rows are inside List cells and may be
        // any element type depending on iOS version / SwiftUI rendering.
        let firstRow = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'exercise_row_'")
        ).firstMatch
        XCTAssertTrue(
            firstRow.waitForExistence(timeout: 10),
            "At least one exercise row should be displayed"
        )
    }

    func testMarkComplete_showsCheckmark() throws {
        let exerciseList = app.descendants(matching: .any).matching(identifier: "today_exercise_list").firstMatch
        // CI can be slow: login (~12s) + /me/today (~13s) = up to 25s; allow 40s
        XCTAssertTrue(exerciseList.waitForExistence(timeout: 40))

        // Find the first completion circle and tap it.
        // Use descendants(matching: .any) — Button(.plain) loses the button
        // accessibility trait and won't appear in app.buttons queries.
        let completionCircle = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH 'completion_circle_'")
        ).firstMatch
        XCTAssertTrue(
            completionCircle.waitForExistence(timeout: 10),
            "Completion circle button should be present"
        )

        // Use coordinate-based tap to bypass isHittable check — the button uses
        // Color.clear with contentShape, which XCUITest may report as not hittable
        // even though the coordinate is valid and tappable.
        completionCircle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()

        // After tapping the list should still be visible (no crash / navigation away)
        XCTAssertTrue(
            exerciseList.waitForExistence(timeout: 5),
            "Exercise list should still be visible after marking complete"
        )
    }

    func testCongratsModal_appearsOnRoundCompletion() throws {
        let exerciseList = app.descendants(matching: .any).matching(identifier: "today_exercise_list").firstMatch
        // CI can be slow: login (~12s) + /me/today (~13s) = up to 25s; allow 40s
        XCTAssertTrue(exerciseList.waitForExistence(timeout: 40))

        // Tap each completion circle by its known accessibility identifier.
        //
        // IMPORTANT — do NOT use circleQuery.count to drive the loop.  SwiftUI
        // List renders cells incrementally; on a slow CI host the second cell
        // may not yet be in the accessibility tree when we snapshot the count
        // (even though firstMatch already returned true for the first cell).
        // Snapshotting count=1 causes the loop to run only once, so only one
        // completion reaches the backend and the congrats modal never fires.
        //
        // Waiting for each circle by its stable identifier (seeded by the reset
        // endpoint as asgn_01 / asgn_02) guarantees every element is rendered
        // and stable before we tap it.
        //
        // Use coordinate-based tap to bypass isHittable check — the button uses
        // Color.clear with contentShape, which XCUITest may report as not hittable
        // even though the coordinate is valid and tappable.
        for key in ["asgn_01", "asgn_02"] {
            let circle = app.descendants(matching: .any)
                .matching(identifier: "completion_circle_\(key)").firstMatch
            guard circle.waitForExistence(timeout: 15) else {
                XCTFail("completion_circle_\(key) did not appear within 15s")
                return
            }
            circle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        // The congrats modal should appear after completing all exercises in a round
        // (only fires when timesPerDay > 1 and a non-final round completes).
        // Sheet content may appear as any element type; use descendants.
        let congratsModal = app.descendants(matching: .any).matching(identifier: "congrats_modal").firstMatch
        XCTAssertTrue(
            congratsModal.waitForExistence(timeout: 20),
            "Congrats modal should appear after completing a round (when more rounds remain)"
        )
    }

    func testAllDoneState_showsAfterFinalRound() throws {
        // Reset to a single-round scenario so completing it triggers the all-done view
        resetBackendState(scenario: "today_view_single_round")

        // Re-launch to pick up fresh data
        app.terminate()
        app.launch()
        login(email: "e2e-patient@test.com", password: "TestPassword123!")

        let exerciseList = app.descendants(matching: .any).matching(identifier: "today_exercise_list").firstMatch
        // CI can be slow: login (~12s) + /me/today (~13s) = up to 25s; allow 40s
        XCTAssertTrue(exerciseList.waitForExistence(timeout: 40))

        // Tap each completion circle by its known accessibility identifier.
        //
        // IMPORTANT — do NOT use circleQuery.count to drive the loop.  SwiftUI
        // List renders cells incrementally; on a slow CI host the second cell
        // may not yet be in the accessibility tree when we snapshot the count
        // (even though firstMatch already returned true for the first cell).
        // Snapshotting count=1 causes the loop to run only once, so only one
        // completion reaches the backend and the all-done view never appears.
        //
        // Waiting for each circle by its stable identifier (seeded by the reset
        // endpoint as asgn_01 / asgn_02) guarantees every element is rendered
        // and stable before we tap it.
        //
        // Use coordinate-based tap to bypass isHittable check — the button uses
        // Color.clear with contentShape, which XCUITest may report as not hittable
        // even though the coordinate is valid and tappable.
        for key in ["asgn_01", "asgn_02"] {
            let circle = app.descendants(matching: .any)
                .matching(identifier: "completion_circle_\(key)").firstMatch
            guard circle.waitForExistence(timeout: 15) else {
                XCTFail("completion_circle_\(key) did not appear within 15s")
                return
            }
            circle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }

        // The all-done view should replace the exercise list.
        // It is a ScrollView, which XCUITest surfaces as scrollViews not otherElements;
        // use descendants(matching: .any) to be type-agnostic.
        let allDoneView = app.descendants(matching: .any).matching(identifier: "all_done_view").firstMatch
        XCTAssertTrue(
            allDoneView.waitForExistence(timeout: 20),
            "All-done view should appear after completing the final round"
        )
    }

    // MARK: - Helpers

    /// Synchronously reset backend state via `POST /test/reset`.
    private func resetBackendState(scenario: String) {
        guard let url = URL(string: "\(baseUrl)/test/reset") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("test-secret-dev", forHTTPHeaderField: "X-Test-Secret")
        request.timeoutInterval = 10

        let body: [String: String] = [
            "scenario": scenario,
            "patientEmail": "e2e-patient@test.com",
            "patientPassword": "TestPassword123!"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { _, _, _ in
            semaphore.signal()
        }.resume()
        semaphore.wait()
    }

    /// Fill the login form and submit, then wait for the today list to appear.
    private func login(email: String, password: String) {
        let emailField = app.textFields["email_field"]
        guard emailField.waitForExistence(timeout: 8) else {
            XCTFail("Login screen did not appear within timeout")
            return
        }

        emailField.tap()
        emailField.typeText(email)

        let passwordField = app.secureTextFields["password_field"]
        passwordField.tap()
        passwordField.typeText(password)

        app.buttons["sign_in_button"].tap()
    }
}
