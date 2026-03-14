import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var authManager: AuthManager
    @State private var showSignOutConfirm = false

    private var displayName: String {
        if case .authenticated(_, _, let name) = authManager.state { return name }
        return ""
    }

    var body: some View {
        NavigationStack {
            List {
                // ── Account ───────────────────────────────────
                Section {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle()
                                .fill(Color.somiTeal.opacity(0.15))
                                .frame(width: 52, height: 52)
                            Text(initials)
                                .font(.headline)
                                .foregroundColor(.somiDarkTeal)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(displayName)
                                .font(.headline)
                                .foregroundColor(.somiNavy)
                            Text("Patient")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                } header: {
                    Text("Account")
                }

                // ── Sign Out ──────────────────────────────────
                Section {
                    Button(role: .destructive) {
                        showSignOutConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Profile")
            .confirmationDialog(
                "Sign out of SOMI Home?",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await authManager.signOut() }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var initials: String {
        let words = displayName.split(separator: " ").prefix(2)
        return words.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}
