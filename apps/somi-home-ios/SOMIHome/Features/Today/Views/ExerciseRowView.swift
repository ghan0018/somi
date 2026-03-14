import SwiftUI

struct ExerciseRowView: View {
    let assignment: TodayAssignment
    let timesPerDay: Int
    @ObservedObject var viewModel: TodayViewModel

    // Checkbox tracks the current active round (the first incomplete occurrence).
    private var currentOccurrence: Int { viewModel.currentOccurrence }

    private var isComplete: Bool {
        assignment.completions
            .first(where: { $0.occurrence == currentOccurrence })?.completed == true
    }

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            // Display-only circle — interaction is handled by an overlay button
            // in TodayView that sits outside the NavigationLink's gesture domain.
            // This prevents XCUITest's synthesised taps from accidentally
            // triggering NavigationLink navigation instead of the toggle action.
            completionCircle(isCompleted: isComplete)

            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.exercise?.title ?? "Exercise")
                    .font(.headline)
                    .foregroundColor(.somiNavy)

                parameterText
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func completionCircle(isCompleted: Bool) -> some View {
        ZStack {
            Circle()
                .fill(isCompleted ? Color.somiTeal : Color.clear)
                .frame(width: 44, height: 44)
            Circle()
                .stroke(isCompleted ? Color.somiTeal : Color.gray.opacity(0.4), lineWidth: 2)
                .frame(width: 44, height: 44)
            if isCompleted {
                Image(systemName: "checkmark")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
            }
        }
    }

    private var parameterText: Text {
        let p = assignment.effectiveParams
        var parts: [String] = []
        if let reps = p.reps { parts.append("\(reps) reps") }
        if let sets = p.sets { parts.append("\(sets) sets") }
        if let seconds = p.seconds { parts.append("\(seconds)s hold") }
        return Text(parts.joined(separator: " | "))
    }
}
