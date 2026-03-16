import SwiftUI

extension Color {
    static let somiNavy = Color(hex: "#1B3A4B")
    static let somiTeal = Color(hex: "#6DB6B0")
    static let somiGold = Color(hex: "#D4A843")
    static let somiMint = Color(hex: "#F0F5F4")
    static let somiDarkTeal = Color(hex: "#2C7A7B")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)

        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}

struct SOMIPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.somiTeal)
            )
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}

struct SOMICardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
            )
    }
}

extension View {
    func somiCard() -> some View {
        modifier(SOMICardModifier())
    }
}
