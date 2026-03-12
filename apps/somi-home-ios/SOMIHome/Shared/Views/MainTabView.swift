import SwiftUI

struct MainTabView: View {
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
        }
        .tint(.somiTeal)
    }
}
