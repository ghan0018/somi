import SwiftUI

struct ExerciseRowView: View {
    let assignment: TodayAssignment
    let timesPerDay: Int
    let sessionKey: String
    @ObservedObject var viewModel: TodayViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(assignment.exercise.title)
                .font(.headline)
                .foregroundColor(.somiNavy)

            parameterText
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack(spacing: 8) {
                ForEach(1...timesPerDay, id: \.self) { occurrence in
                    let isCompleted = assignment.completions.contains { $0.occurrence == occurrence }
                    Button {
                        guard !isCompleted else { return }
                        Task {
                            await viewModel.markComplete(
                                assignmentKey: assignment.assignmentKey,
                                exerciseVersionId: assignment.exerciseVersionId,
                                occurrence: occurrence,
                                sessionKey: sessionKey
                            )
                        }
                    } label: {
                        completionCircle(isCompleted: isCompleted)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func completionCircle(isCompleted: Bool) -> some View {
        ZStack {
            Circle()
                .fill(isCompleted ? Color.somiTeal : Color.clear)
                .frame(width: 28, height: 28)
            Circle()
                .stroke(isCompleted ? Color.somiTeal : Color.gray.opacity(0.4), lineWidth: 2)
                .frame(width: 28, height: 28)
            if isCompleted {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
            }
        }
    }

    private var parameterText: Text {
        let params = effectiveParams(assignment: assignment)
        var parts: [String] = []
        if let reps = params.reps { parts.append("\(reps) reps") }
        if let sets = params.sets { parts.append("\(sets) sets") }
        if let seconds = params.seconds { parts.append("\(seconds)s hold") }
        return Text(parts.joined(separator: " | "))
    }
}

func effectiveParams(assignment: TodayAssignment) -> ExerciseParams {
    let defaults = assignment.exercise.defaultParams
    let overrides = assignment.paramsOverride
    return ExerciseParams(
        reps: overrides?.reps ?? defaults.reps,
        sets: overrides?.sets ?? defaults.sets,
        seconds: overrides?.seconds ?? defaults.seconds
    )
}
