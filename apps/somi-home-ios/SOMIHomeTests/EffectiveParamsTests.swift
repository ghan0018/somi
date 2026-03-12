import XCTest
@testable import SOMIHome

final class EffectiveParamsTests: XCTestCase {

    // MARK: - Helpers

    /// Computes effective params by merging defaultParams with optional paramsOverride.
    /// Override values win; nil override fields fall through to defaults.
    private func effectiveParams(
        defaultParams: ExerciseParams,
        paramsOverride: ExerciseParams?
    ) -> ExerciseParams {
        guard let override = paramsOverride else {
            return defaultParams
        }
        return ExerciseParams(
            reps: override.reps ?? defaultParams.reps,
            sets: override.sets ?? defaultParams.sets,
            seconds: override.seconds ?? defaultParams.seconds
        )
    }

    // MARK: - Tests

    func testDefaultParamsUsedWhenNoOverride() {
        // Arrange
        let defaults = ExerciseParams(reps: 10, sets: 3, seconds: 30)

        // Act
        let result = effectiveParams(defaultParams: defaults, paramsOverride: nil)

        // Assert
        XCTAssertEqual(result.reps, 10)
        XCTAssertEqual(result.sets, 3)
        XCTAssertEqual(result.seconds, 30)
    }

    func testParamsOverrideWinsOverDefault() {
        // Arrange
        let defaults = ExerciseParams(reps: 10, sets: 3, seconds: 30)
        let override = ExerciseParams(reps: 20, sets: 5, seconds: 60)

        // Act
        let result = effectiveParams(defaultParams: defaults, paramsOverride: override)

        // Assert
        XCTAssertEqual(result.reps, 20)
        XCTAssertEqual(result.sets, 5)
        XCTAssertEqual(result.seconds, 60)
    }

    func testPartialOverrideMergesCorrectly() {
        // Arrange — override only reps, keep default sets and seconds
        let defaults = ExerciseParams(reps: 10, sets: 3, seconds: 30)
        let override = ExerciseParams(reps: 20, sets: nil, seconds: nil)

        // Act
        let result = effectiveParams(defaultParams: defaults, paramsOverride: override)

        // Assert
        XCTAssertEqual(result.reps, 20, "Overridden reps should take override value")
        XCTAssertEqual(result.sets, 3, "Non-overridden sets should keep default")
        XCTAssertEqual(result.seconds, 30, "Non-overridden seconds should keep default")
    }

    func testOverrideWithAllNilsKeepsDefaults() {
        // Arrange — override object exists but all fields nil
        let defaults = ExerciseParams(reps: 10, sets: 3, seconds: 30)
        let override = ExerciseParams(reps: nil, sets: nil, seconds: nil)

        // Act
        let result = effectiveParams(defaultParams: defaults, paramsOverride: override)

        // Assert
        XCTAssertEqual(result.reps, 10)
        XCTAssertEqual(result.sets, 3)
        XCTAssertEqual(result.seconds, 30)
    }

    func testDefaultsWithNilFieldsAndNoOverride() {
        // Arrange — defaults have some nil fields
        let defaults = ExerciseParams(reps: nil, sets: nil, seconds: 60)

        // Act
        let result = effectiveParams(defaultParams: defaults, paramsOverride: nil)

        // Assert
        XCTAssertNil(result.reps)
        XCTAssertNil(result.sets)
        XCTAssertEqual(result.seconds, 60)
    }
}
