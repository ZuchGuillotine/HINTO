import SwiftUI

extension Color {
    // MARK: - Primary Brand (Vibrant Pink)
    static let hintoPink = Color(hex: "FF4275")
    static let hintoPink50 = Color(hex: "FFF1F3")
    static let hintoPink100 = Color(hex: "FFE4E8")
    static let hintoPink200 = Color(hex: "FFCDD6")
    static let hintoPink300 = Color(hex: "FFA8B8")
    static let hintoPink400 = Color(hex: "FF7396")
    static let hintoPink600 = Color(hex: "E91E5E")
    static let hintoPink700 = Color(hex: "C4124A")
    static let hintoPink800 = Color(hex: "A31440")
    static let hintoPink900 = Color(hex: "8B1538")

    // MARK: - Secondary (Sky Blue)
    static let hintoBlue = Color(hex: "0EA5E9")
    static let hintoBlue50 = Color(hex: "F0F9FF")
    static let hintoBlue100 = Color(hex: "E0F2FE")
    static let hintoBlue400 = Color(hex: "38BDF8")

    // MARK: - Neutral
    static let neutral50 = Color(hex: "FAFAFA")
    static let neutral100 = Color(hex: "F5F5F5")
    static let neutral200 = Color(hex: "E5E5E5")
    static let neutral300 = Color(hex: "D4D4D4")
    static let neutral400 = Color(hex: "A3A3A3")
    static let neutral500 = Color(hex: "737373")
    static let neutral600 = Color(hex: "525252")
    static let neutral700 = Color(hex: "404040")
    static let neutral800 = Color(hex: "262626")
    static let neutral900 = Color(hex: "171717")

    // MARK: - Semantic
    static let hintoSuccess = Color(hex: "22C55E")
    static let hintoWarning = Color(hex: "F59E0B")
    static let hintoError = Color(hex: "EF4444")

    // MARK: - Social
    static let socialGoogle = Color(hex: "4285F4")
    static let socialInstagram = Color(hex: "E1306C")
    static let socialSnapchat = Color(hex: "FFFC00")
    static let socialTikTok = Color(hex: "000000")
    static let socialApple = Color(hex: "000000")
    static let socialFacebook = Color(hex: "1877F2")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: .alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Adaptive Colors

extension ShapeStyle where Self == Color {
    static var cardBackground: Color {
        Color(.systemBackground)
    }

    static var secondaryBackground: Color {
        Color(.secondarySystemBackground)
    }

    static var tertiaryBackground: Color {
        Color(.tertiarySystemBackground)
    }
}
