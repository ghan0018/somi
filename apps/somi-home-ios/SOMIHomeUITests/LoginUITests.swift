// ─────────────────────────────────────────────────────────────────────────────
// LoginUITests
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
// ─────────────────────────────────────────────────────────────────────────────

import XCTest

final class LoginUITests: XCTestCase {
    var app: XCUIApplication!
    let baseUrl = "http://localhost:3000"

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Failure screenshots

    /// Capture a screenshot at the exact moment any assertion fails.
    /// The attachment is stored in the xcresult bundle; the CI workflow
    /// extracts and uploads it as a PNG artifact for remote debugging.
    override func record(_ issue: XCTIssue) {
        if app != nil {
            let screenshot = app.screenshot()
            let attachment = XCTAttachment(screenshot: screenshot)
            attachment.name = "Failure — \(name)"
            attachment.lifetime = .keepAlways
            var mutableIssue = issue
            mutableIssue.add(attachment)
            super.record(mutableIssue)
        } else {
            super.record(issue)
        }
    }

    // MARK: - Tests

    func testLogin_withValidCredentials_navigatesToTodayTab() throws {
        // Seed a known e2e patient so we always have a predictable state
        resetBackendState(scenario: "today_view_single_round")

        let emailField = app.textFields["email_field"]
        let passwordField = app.secureTextFields["password_field"]
        let signInButton = app.buttons["sign_in_button"]

        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field should be visible")
        XCTAssertTrue(passwordField.exists, "Password field should be visible")
        XCTAssertTrue(signInButton.exists, "Sign In button should be visible")

        emailField.tap()
        emailField.typeText("e2e-patient@test.com")

        passwordField.tap()
        passwordField.typeText("TestPassword123!")

        signInButton.tap()

        // After successful login the exercise list should appear.
        // List renders as collectionView in iOS 16+; use descendants to be type-agnostic.
        let exerciseList = app.descendants(matching: .any).matching(identifier: "today_exercise_list").firstMatch
        XCTAssertTrue(
            // CI can be slow: login (~14s) + /me/today (~52s cold) = up to 66s; allow 120s
            exerciseList.waitForExistence(timeout: 120),
            "Today exercise list should be visible after successful login"
        )
    }

    // MARK: - Helpers

    private func resetBackendState(scenario: String) {
        guard let url = URL(string: "\(baseUrl)/test/reset") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("test-secret-dev", forHTTPHeaderField: "X-Test-Secret")
        request.timeoutInterval = 30
        let body: [String: String] = [
            "scenario": scenario,
            "patientEmail": "e2e-patient@test.com",
            "patientPassword": "TestPassword123!"
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { _, _, _ in semaphore.signal() }.resume()
        semaphore.wait()
    }

    func testLogin_withInvalidCredentials_showsError() throws {
        let emailField = app.textFields["email_field"]
        let passwordField = app.secureTextFields["password_field"]
        let signInButton = app.buttons["sign_in_button"]

        XCTAssertTrue(emailField.waitForExistence(timeout: 5), "Email field should be visible")

        emailField.tap()
        emailField.typeText("wrong@example.com")

        passwordField.tap()
        passwordField.typeText("wrongpassword")

        signInButton.tap()

        // An error message should appear — look for any static text indicating failure
        let errorPredicate = NSPredicate(format: "label CONTAINS[c] 'invalid' OR label CONTAINS[c] 'incorrect' OR label CONTAINS[c] 'wrong' OR label CONTAINS[c] 'error' OR label CONTAINS[c] 'failed'")
        let errorText = app.staticTexts.element(matching: errorPredicate)
        XCTAssertTrue(
            errorText.waitForExistence(timeout: 10),
            "An error message should appear after entering invalid credentials"
        )
    }
}
