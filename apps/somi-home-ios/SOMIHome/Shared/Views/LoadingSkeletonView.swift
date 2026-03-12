import SwiftUI

struct LoadingSkeletonView: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(spacing: 16) {
            ForEach(0..<5, id: \.self) { _ in
                skeletonRow
            }
            Spacer()
        }
        .padding(16)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }

    private var skeletonRow: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(isAnimating ? 0.15 : 0.08))
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(isAnimating ? 0.15 : 0.08))
                    .frame(height: 14)
                    .frame(maxWidth: 180)

                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(isAnimating ? 0.12 : 0.06))
                    .frame(height: 10)
                    .frame(maxWidth: 120)
            }

            Spacer()

            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { _ in
                    Circle()
                        .fill(Color.gray.opacity(isAnimating ? 0.12 : 0.06))
                        .frame(width: 24, height: 24)
                }
            }
        }
        .padding(12)
        .somiCard()
    }
}
