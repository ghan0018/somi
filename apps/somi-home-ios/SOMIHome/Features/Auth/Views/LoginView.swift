import SwiftUI

// MARK: - Logo Mark

/// Four-petal logo mark matching the web app's SomiLogo component.
private struct SOMILogoMark: View {
    let size: CGFloat

    private struct Petal {
        let color: Color
        let opacity: Double
        // Each petal: two cubic bezier segments in a 100×100 coordinate space
        let move: CGPoint
        let curve1To: CGPoint; let c1a: CGPoint; let c1b: CGPoint
        let curve2To: CGPoint; let c2a: CGPoint; let c2b: CGPoint
    }

    private var petals: [Petal] { [
        Petal(color: .somiTeal,     opacity: 0.92,
              move:    CGPoint(x: 50, y: 50),
              curve1To: CGPoint(x: 32, y: 22), c1a: CGPoint(x: 38, y: 46), c1b: CGPoint(x: 28, y: 36),
              curve2To: CGPoint(x: 50, y: 50), c2a: CGPoint(x: 36, y: 10), c2b: CGPoint(x: 50, y: 14)),
        Petal(color: Color(hex: "#E8DCC8"), opacity: 0.92,
              move:    CGPoint(x: 50, y: 50),
              curve1To: CGPoint(x: 78, y: 32), c1a: CGPoint(x: 54, y: 38), c1b: CGPoint(x: 64, y: 28),
              curve2To: CGPoint(x: 50, y: 50), c2a: CGPoint(x: 90, y: 36), c2b: CGPoint(x: 86, y: 50)),
        Petal(color: .somiGold,     opacity: 0.92,
              move:    CGPoint(x: 50, y: 50),
              curve1To: CGPoint(x: 68, y: 78), c1a: CGPoint(x: 62, y: 54), c1b: CGPoint(x: 72, y: 64),
              curve2To: CGPoint(x: 50, y: 50), c2a: CGPoint(x: 64, y: 90), c2b: CGPoint(x: 50, y: 86)),
        Petal(color: .somiDarkTeal, opacity: 0.92,
              move:    CGPoint(x: 50, y: 50),
              curve1To: CGPoint(x: 22, y: 68), c1a: CGPoint(x: 46, y: 62), c1b: CGPoint(x: 36, y: 72),
              curve2To: CGPoint(x: 50, y: 50), c2a: CGPoint(x: 10, y: 64), c2b: CGPoint(x: 14, y: 50)),
    ] }

    var body: some View {
        let s = size / 100
        ZStack {
            ForEach(0..<petals.count, id: \.self) { i in
                let p = petals[i]
                Path { path in
                    path.move(to: p.move * s)
                    path.addCurve(to: p.curve1To * s, control1: p.c1a * s, control2: p.c1b * s)
                    path.addCurve(to: p.curve2To * s, control1: p.c2a * s, control2: p.c2b * s)
                    path.closeSubpath()
                }
                .fill(p.color.opacity(p.opacity))
            }
            // Central overlap highlight
            Circle()
                .fill(Color.white.opacity(0.35))
                .frame(width: size * 0.12, height: size * 0.12)
        }
        .frame(width: size, height: size)
    }
}

private extension CGPoint {
    static func * (lhs: CGPoint, rhs: CGFloat) -> CGPoint {
        CGPoint(x: lhs.x * rhs, y: lhs.y * rhs)
    }
}

// MARK: - Login View

struct LoginView: View {
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // ── Branding ──────────────────────────────────────
                VStack(spacing: 12) {
                    SOMILogoMark(size: 80)

                    Text("SOMI")
                        .font(.system(size: 42, weight: .bold))
                        .foregroundColor(.somiNavy)

                    Text("Speech · Ortho-Airway · Myofunctional · Integration")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
                .padding(.top, 72)
                .padding(.bottom, 48)

                // ── Form card ────────────────────────────────────
                VStack(spacing: 0) {
                    Text("Sign In")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.somiNavy)
                        .padding(.bottom, 20)

                    VStack(spacing: 14) {
                        TextField("Email", text: $viewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .padding()
                            .background(Color.gray.opacity(0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .accessibilityIdentifier("email_field")

                        SecureField("Password", text: $viewModel.password)
                            .textContentType(.password)
                            .padding()
                            .background(Color.gray.opacity(0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .accessibilityIdentifier("password_field")

                        if let error = viewModel.errorMessage {
                            Text(error)
                                .font(.footnote)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }

                        Button {
                            Task { await viewModel.signIn() }
                        } label: {
                            if viewModel.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Sign In")
                            }
                        }
                        .buttonStyle(SOMIPrimaryButtonStyle())
                        .disabled(viewModel.isLoading)
                        .padding(.top, 4)
                        .accessibilityIdentifier("sign_in_button")
                    }
                }
                .padding(24)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.white)
                        .shadow(color: .black.opacity(0.08), radius: 12, x: 0, y: 4)
                )
                .padding(.horizontal, 24)

                Spacer(minLength: 48)
            }
        }
        .background(Color.somiMint.ignoresSafeArea())
    }
}
