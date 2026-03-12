import SwiftUI

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundColor(.somiTeal.opacity(0.6))

            Text(title)
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundColor(.somiNavy)

            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(SOMIPrimaryButtonStyle())
                    .padding(.horizontal, 64)
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.somiMint.ignoresSafeArea())
    }
}
