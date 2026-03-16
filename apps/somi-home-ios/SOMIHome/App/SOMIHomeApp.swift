import SwiftUI

@main
struct SOMIHomeApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var syncManager = CompletionSyncManager.shared

    /// True when launched by XCUITest — skip cached auth so tests always start at login.
    private let isUITesting = CommandLine.arguments.contains("--uitesting")

    var body: some Scene {
        WindowGroup {
            Group {
                switch authManager.state {
                case .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.somiMint.ignoresSafeArea())
                case .unauthenticated:
                    LoginView()
                case .authenticated:
                    MainTabView()
                        .environmentObject(authManager)
                }
            }
            .task {
                if isUITesting {
                    // Clear any persisted tokens so every UI test run starts at the login screen.
                    await authManager.signOut()
                } else {
                    await authManager.restoreSession()
                }
            }
            .onAppear {
                syncManager.startMonitoring()
            }
        }
    }
}
