import SwiftUI

struct TodayView: View {
    @StateObject private var viewModel = TodayViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.todayData == nil {
                    LoadingSkeletonView()
                } else if let error = viewModel.errorMessage, viewModel.todayData == nil {
                    EmptyStateView(
                        systemImage: "exclamationmark.triangle",
                        title: "Unable to Load",
                        message: error,
                        actionTitle: "Retry"
                    ) {
                        Task { await viewModel.loadToday() }
                    }
                } else if let data = viewModel.todayData {
                    exerciseList(data: data)
                } else {
                    EmptyStateView(
                        systemImage: "checkmark.circle",
                        title: "No Exercises Today",
                        message: "You don't have any exercises assigned for today."
                    )
                }
            }
            .navigationTitle("Today")
            .toolbar {
                if viewModel.pendingCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        SyncBadgeView(count: viewModel.pendingCount)
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadToday()
            }
        }
    }

    @ViewBuilder
    private func exerciseList(data: TodayViewResponse) -> some View {
        List {
            ForEach(data.sessions, id: \.sessionKey) { session in
                Section {
                    ForEach(session.assignments) { assignment in
                        NavigationLink {
                            ExerciseDetailView(
                                assignment: assignment,
                                timesPerDay: session.timesPerDay,
                                sessionKey: session.sessionKey,
                                viewModel: viewModel
                            )
                        } label: {
                            ExerciseRowView(
                                assignment: assignment,
                                timesPerDay: session.timesPerDay,
                                sessionKey: session.sessionKey,
                                viewModel: viewModel
                            )
                        }
                    }
                } header: {
                    if let title = session.title {
                        Text(title)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}
