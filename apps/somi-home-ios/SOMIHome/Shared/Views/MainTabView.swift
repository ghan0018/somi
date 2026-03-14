import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var authManager: AuthManager

    var body: some View {
        TabView {
            TodayView()
                .tabItem {
                    Label("Today", systemImage: "calendar")
                }

            TreatmentPlanView()
                .tabItem {
                    Label("Plan", systemImage: "list.bullet.clipboard")
                }

            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "message.fill")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle")
                }
        }
        .tint(.somiTeal)
    }
}
