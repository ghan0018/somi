import SwiftUI

@main
struct SOMIHomeApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var syncManager = CompletionSyncManager.shared

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
                }
            }
            .task {
                await authManager.restoreSession()
            }
            .onAppear {
                syncManager.startMonitoring()
            }
        }
    }
}
