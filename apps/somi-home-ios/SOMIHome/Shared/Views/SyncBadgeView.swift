import SwiftUI

struct SyncBadgeView: View {
    let count: Int

    var body: some View {
        if count > 0 {
            HStack(spacing: 4) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.caption2)
                Text("\(count) pending")
                    .font(.caption2)
                    .fontWeight(.medium)
            }
            .foregroundColor(Color(hex: "#9E7C2E"))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.somiGold.opacity(0.2))
            )
        }
    }
}
