import Foundation
@testable import SOMIHome

// MARK: - MockAPIClient
//
// Lightweight test double used in unit tests to intercept APIClient calls.
// Tests call it directly rather than injecting it into the ViewModel singleton.

final class MockAPIClient {

    /// Set this handler to control what `fetch<T>` returns or throws.
    var fetchHandler: ((Endpoint) throws -> Any)?

    /// Set this handler to control what `fetchVoid` returns or throws.
    var fetchVoidHandler: ((Endpoint) throws -> Void)?

    /// Total number of calls made across both `fetch` and `fetchVoid`.
    private(set) var fetchCallCount = 0

    func fetch<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        fetchCallCount += 1
        guard let handler = fetchHandler else {
            throw APIError.unknown
        }
        let result = try handler(endpoint)
        guard let typed = result as? T else {
            throw APIError.decodingError
        }
        return typed
    }

    func fetchVoid(_ endpoint: Endpoint) async throws {
        fetchCallCount += 1
        try fetchVoidHandler?(endpoint)
    }
}
