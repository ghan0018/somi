import SwiftUI

struct SessionDetailView: View {
    let session: PlanSession

    var body: some View {
        List {
            Section {
                HStack {
                    Label("Exercises", systemImage: "figure.run")
                    Spacer()
                    Text("\(session.assignments.count)")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Label("Times per day", systemImage: "clock")
                    Spacer()
                    Text("\(session.timesPerDay)")
                        .foregroundColor(.secondary)
                }
            } header: {
                Text("Overview")
            }

            Section {
                ForEach(session.assignments.sorted(by: { $0.index < $1.index })) { assignment in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(assignment.exercise?.title ?? "Exercise")
                            .font(.headline)
                            .foregroundColor(.somiNavy)

                        if let desc = assignment.exercise?.description {
                            Text(desc)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }

                        assignmentParams(assignment: assignment)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text("Exercises")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(session.title ?? "Session \(session.index + 1)")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func assignmentParams(assignment: PlanAssignment) -> some View {
        let defaults = assignment.exercise?.defaultParams
        let overrides = assignment.paramsOverride
        let reps = overrides?.reps ?? defaults?.reps
        let sets = overrides?.sets ?? defaults?.sets
        let seconds = overrides?.seconds ?? defaults?.seconds

        HStack(spacing: 12) {
            if let reps {
                paramChip("\(reps) reps")
            }
            if let sets {
                paramChip("\(sets) sets")
            }
            if let seconds {
                paramChip("\(seconds)s")
            }
        }
    }

    @ViewBuilder
    private func paramChip(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(Color.somiTeal.opacity(0.12))
            )
            .foregroundColor(.somiDarkTeal)
    }
}
