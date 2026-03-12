import SwiftUI

struct ExerciseDetailView: View {
    let assignment: TodayAssignment
    let timesPerDay: Int
    let sessionKey: String
    @ObservedObject var viewModel: TodayViewModel

    private var params: ExerciseParams {
        effectiveParams(assignment: assignment)
    }

    private var nextOccurrence: Int? {
        for occ in 1...timesPerDay {
            if !assignment.completions.contains(where: { $0.occurrence == occ }) {
                return occ
            }
        }
        return nil
    }

    private var allComplete: Bool {
        nextOccurrence == nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Title
                Text(assignment.exercise.title)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.somiNavy)

                // Description
                Text(assignment.exercise.description)
                    .font(.body)
                    .foregroundColor(.secondary)

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
                if let mediaId = assignment.exercise.mediaId {
                    VideoPlayerView(mediaId: mediaId)
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Completion status
                HStack(spacing: 8) {
                    ForEach(1...timesPerDay, id: \.self) { occurrence in
                        let isCompleted = assignment.completions.contains { $0.occurrence == occurrence }
                        ZStack {
                            Circle()
                                .fill(isCompleted ? Color.somiTeal : Color.gray.opacity(0.15))
                                .frame(width: 36, height: 36)
                            if isCompleted {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            } else {
                                Text("\(occurrence)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                Spacer(minLength: 16)

                // Mark Complete button
                Button {
                    guard let occ = nextOccurrence else { return }
                    Task {
                        await viewModel.markComplete(
                            assignmentKey: assignment.assignmentKey,
                            exerciseVersionId: assignment.exerciseVersionId,
                            occurrence: occ,
                            sessionKey: sessionKey
                        )
                    }
                } label: {
                    HStack {
                        if allComplete {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Completed")
                        } else {
                            Text("Mark Complete")
                        }
                    }
                }
                .buttonStyle(SOMIPrimaryButtonStyle())
                .disabled(allComplete)
                .opacity(allComplete ? 0.6 : 1.0)
            }
            .padding(20)
        }
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.somiMint.ignoresSafeArea())
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
        .background(
            Capsule()
                .fill(Color.somiTeal.opacity(0.12))
        )
        .foregroundColor(.somiDarkTeal)
    }
}
