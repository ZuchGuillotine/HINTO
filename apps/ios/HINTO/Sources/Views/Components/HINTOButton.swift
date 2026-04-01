import SwiftUI

enum HINTOButtonStyle {
    case primary
    case secondary
    case destructive
    case ghost
}

struct HINTOButton: View {
    let title: String
    let style: HINTOButtonStyle
    var icon: String?
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .tint(foregroundColor)
                } else {
                    if let icon {
                        Image(systemName: icon)
                            .font(.body.weight(.semibold))
                    }
                    Text(title)
                        .font(.hintoButton)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(foregroundColor)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            .overlay {
                if style == .secondary || style == .ghost {
                    RoundedRectangle(cornerRadius: CornerRadius.md)
                        .strokeBorder(borderColor, lineWidth: style == .ghost ? 0 : 1.5)
                }
            }
        }
        .disabled(isLoading)
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: .hintoPink
        case .secondary: .clear
        case .destructive: .clear
        case .ghost: .clear
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .primary: .white
        case .secondary: .hintoPink
        case .destructive: .hintoError
        case .ghost: .primary
        }
    }

    private var borderColor: Color {
        switch style {
        case .primary: .clear
        case .secondary: .hintoPink
        case .destructive: .hintoError
        case .ghost: .clear
        }
    }
}

// MARK: - Social Auth Button

struct SocialAuthButton: View {
    let provider: AuthProvider
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: provider.iconName)
                    .font(.title3)
                    .frame(width: 24)

                Text(provider.displayName)
                    .font(.hintoButton)

                Spacer()
            }
            .padding(.horizontal, Spacing.md)
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            .foregroundStyle(provider.foregroundColor)
            .background(provider.backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        HINTOButton(title: "Get Started", style: .primary) {}
        HINTOButton(title: "Sign Up", style: .secondary) {}
        HINTOButton(title: "Delete", style: .destructive, icon: "trash") {}
        HINTOButton(title: "Loading...", style: .primary, isLoading: true) {}

        Divider()

        ForEach(AuthProvider.allCases) { provider in
            SocialAuthButton(provider: provider) {}
        }
    }
    .padding()
}
