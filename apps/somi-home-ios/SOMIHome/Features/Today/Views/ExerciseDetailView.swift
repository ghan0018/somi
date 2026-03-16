import SwiftUI

struct ExerciseDetailView: View {
    let assignment: TodayAssignment
    let timesPerDay: Int
    @ObservedObject var viewModel: TodayViewModel

    private var params: ExerciseParams { assignment.effectiveParams }
    private var currentOccurrence: Int { viewModel.currentOccurrence }

    private var isComplete: Bool {
        assignment.completions
            .first(where: { $0.occurrence == currentOccurrence })?.completed == true
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Title
                Text(assignment.exercise?.title ?? "Exercise")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.somiNavy)
                    .accessibilityIdentifier("exercise_title")

                // Description
                if let description = assignment.exercise?.description {
                    Text(description)
                        .font(.body)
                        .foregroundColor(.secondary)
                }

                // Parameter chips
                HStack(spacing: 12) {
                    if let reps = params.reps {
                        parameterChip(label: "\(reps) reps", icon: "repeat")
                    }
                    if let sets = params.sets {
                        parameterChip(label: "\(sets) sets", icon: "square.stack")
                    }
                    if let seconds = params.seconds {
                        parameterChip(label: "\(seconds)s", icon: "timer")
                    }
                }

                // Video
                if let mediaId = assignment.exercise?.mediaId {
                    VideoPlayerView(mediaId: mediaId)
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Spacer(minLength: 16)

                // Mark Complete / Undo button
                Button {
                    Task {
                        if isComplete {
                            await viewModel.markIncomplete(
                                assignmentKey: assignment.assignmentKey,
                                exerciseVersionId: assignment.exerciseVersionId,
                                occurrence: currentOccurrence
                            )
                        } else {
                            await viewModel.markComplete(
                                assignmentKey: assignment.assignmentKey,
                                exerciseVersionId: assignment.exerciseVersionId,
                                occurrence: currentOccurrence
                            )
                        }
                    }
                } label: {
                    HStack {
                        if isComplete {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Completed — Tap to Undo")
                        } else {
                            Text("Mark Complete")
                        }
                    }
                }
                .buttonStyle(SOMIPrimaryButtonStyle())
                .opacity(isComplete ? 0.7 : 1.0)
                .accessibilityIdentifier("mark_complete_button")
            }
            .padding(20)
        }
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.white.ignoresSafeArea())
    }

    @ViewBuilder
    private func parameterChip(label: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
            Text(label)
                .font(.subheadline)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Capsule().fill(Color.somiTeal.opacity(0.12)))
        .foregroundColor(.somiDarkTeal)
    }
}
