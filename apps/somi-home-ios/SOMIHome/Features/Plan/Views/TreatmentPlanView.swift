import SwiftUI

struct TreatmentPlanView: View {
    @StateObject private var viewModel = PlanViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.plan == nil {
                    LoadingSkeletonView()
                } else if viewModel.isEmpty {
                    EmptyStateView(
                        systemImage: "list.bullet.clipboard",
                        title: "No Treatment Plan",
                        message: "Your therapist hasn't created a treatment plan yet."
                    )
                } else if let error = viewModel.errorMessage, viewModel.plan == nil {
                    EmptyStateView(
                        systemImage: "exclamationmark.triangle",
                        title: "Unable to Load",
                        message: error,
                        actionTitle: "Retry"
                    ) {
                        Task { await viewModel.loadPlan() }
                    }
                } else if let plan = viewModel.plan {
                    planList(plan: plan)
                }
            }
            .navigationTitle("Treatment Plan")
            .task {
                await viewModel.loadPlan()
            }
        }
    }

    @ViewBuilder
    private func planList(plan: TreatmentPlan) -> some View {
        List {
            ForEach(plan.sessions.sorted(by: { $0.index < $1.index })) { session in
                NavigationLink {
                    SessionDetailView(session: session)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.title ?? "Session \(session.index + 1)")
                            .font(.headline)
                            .foregroundColor(.somiNavy)
                        Text("\(session.assignments.count) exercises | \(session.timesPerDay)x daily")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}
