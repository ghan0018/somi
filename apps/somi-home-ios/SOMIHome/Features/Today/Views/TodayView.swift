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
                    if viewModel.isAllDoneForDay {
                        allDoneView(data: data)
                    } else {
                        exerciseList(data: data)
                    }
                } else {
                    EmptyStateView(
                        systemImage: "list.bullet.clipboard",
                        title: "No Treatment Plan",
                        message: "Your therapist hasn't published a treatment plan yet. Check back soon."
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
            .sheet(isPresented: $viewModel.showCongratsModal) {
                CongratsModalView(
                    roundsCompleted: viewModel.completedRoundsToday,
                    totalRounds: viewModel.todayData?.timesPerDay ?? 1
                ) {
                    viewModel.showCongratsModal = false
                }
                .presentationDetents([.medium])
                .accessibilityIdentifier("congrats_modal")
            }
        }
    }

    // MARK: - Exercise list

    @ViewBuilder
    private func exerciseList(data: TodayViewResponse) -> some View {
        List {
            Section {
                ForEach(data.assignments) { assignment in
                    NavigationLink {
                        ExerciseDetailView(
                            assignment: assignment,
                            timesPerDay: data.timesPerDay,
                            viewModel: viewModel
                        )
                    } label: {
                        ExerciseRowView(
                            assignment: assignment,
                            timesPerDay: data.timesPerDay,
                            viewModel: viewModel
                        )
                        .accessibilityIdentifier("exercise_row_\(assignment.assignmentKey)")
                    }
                    // The completion button is an overlay that sits on top of (and
                    // therefore outside the gesture domain of) the NavigationLink.
                    // This guarantees that XCUITest's synthesised tap on
                    // completion_circle_ fires only the toggle action and never
                    // accidentally triggers NavigationLink navigation.
                    .overlay(alignment: .leading) {
                        completionButton(for: assignment)
                    }
                }
            } header: {
                VStack(alignment: .leading, spacing: 4) {
                    if let title = data.sessionTitle {
                        Text(title)
                    }
                    // Progress: e.g. "1 / 2 times today"
                    if data.timesPerDay > 1 {
                        Text("\(viewModel.completedRoundsToday) / \(data.timesPerDay) times today")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            // Therapist notes footer
            if let notes = data.sessionNotes, !notes.isEmpty {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Notes from your therapist", systemImage: "note.text")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.somiNavy)
                        Text(notes)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .accessibilityIdentifier("session_notes")
            }
        }
        .listStyle(.insetGrouped)
        .accessibilityIdentifier("today_exercise_list")
    }

    // MARK: - Completion overlay

    /// Transparent button that covers the leading completion circle in a row.
    /// Being an overlay it renders above the NavigationLink, so XCUITest
    /// synthesised taps land here and never trigger row navigation.
    @ViewBuilder
    private func completionButton(for assignment: TodayAssignment) -> some View {
        Button {
            Task { await toggleCompletion(assignment) }
        } label: {
            // Match the circle frame (44×44) + row's vertical padding (4 each side = 8).
            // contentShape is required: Color.clear has no hit area by default and
            // touches would otherwise pass through to the NavigationLink beneath.
            Color.clear
                .frame(width: 58, height: 52)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("completion_circle_\(assignment.assignmentKey)")
    }

    private func isComplete(_ assignment: TodayAssignment) -> Bool {
        assignment.completions
            .first(where: { $0.occurrence == viewModel.currentOccurrence })?.completed == true
    }

    private func toggleCompletion(_ assignment: TodayAssignment) async {
        let occ = viewModel.currentOccurrence
        if isComplete(assignment) {
            await viewModel.markIncomplete(
                assignmentKey: assignment.assignmentKey,
                exerciseVersionId: assignment.exerciseVersionId,
                occurrence: occ
            )
        } else {
            await viewModel.markComplete(
                assignmentKey: assignment.assignmentKey,
                exerciseVersionId: assignment.exerciseVersionId,
                occurrence: occ
            )
        }
    }

    // MARK: - All-done state

    @ViewBuilder
    private func allDoneView(data: TodayViewResponse) -> some View {
        ScrollView {
            VStack(spacing: 32) {
                Spacer(minLength: 40)

                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.somiTeal)

                VStack(spacing: 12) {
                    Text("Great work today! 🎉")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.somiNavy)

                    Text("You've completed all of your exercises for today. Take care and we'll see you tomorrow!")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                Spacer(minLength: 40)
            }
            .frame(maxWidth: .infinity)
        }
        .refreshable {
            await viewModel.refresh()
        }
        .accessibilityIdentifier("all_done_view")
    }
}

// MARK: - CongratsModalView

private struct CongratsModalView: View {
    let roundsCompleted: Int
    let totalRounds: Int
    let onDismiss: () -> Void

    private var ordinal: String {
        switch roundsCompleted {
        case 1: return "1st"
        case 2: return "2nd"
        case 3: return "3rd"
        default: return "\(roundsCompleted)th"
        }
    }

    var body: some View {
        VStack(spacing: 28) {
            // Animated checkmark
            ZStack {
                Circle()
                    .fill(Color.somiTeal.opacity(0.12))
                    .frame(width: 100, height: 100)
                Image(systemName: "star.fill")
                    .font(.system(size: 44))
                    .foregroundColor(.somiTeal)
            }
            .padding(.top, 32)

            VStack(spacing: 10) {
                Text("Round complete!")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.somiNavy)

                Text("You've finished your \(ordinal) round of exercises. Keep it up — \(totalRounds - roundsCompleted) more to go!")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Button("Keep going!") {
                onDismiss()
            }
            .buttonStyle(SOMIPrimaryButtonStyle())
            .padding(.horizontal, 32)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
        .background(Color(.systemBackground))
    }
}
