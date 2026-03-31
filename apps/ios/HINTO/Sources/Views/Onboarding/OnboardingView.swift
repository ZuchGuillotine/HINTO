import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @State private var currentPage = 0
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false

    private let slides: [(emoji: String, title: String, description: String)] = [
        ("💖", "Welcome to HINTO", "Navigate your dating life with clarity and get the truth about your situationships."),
        ("📊", "Rank Your People", "Add the people in your life and drag to reorder based on your priorities."),
        ("🤖", "AI Coach", "Get private, personalized relationship advice 24/7 from your AI assistant."),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Top: Feature carousel
            TabView(selection: $currentPage) {
                ForEach(Array(slides.enumerated()), id: \.offset) { index, slide in
                    VStack(spacing: Spacing.lg) {
                        Text(slide.emoji)
                            .font(.system(size: 80))
                            .symbolEffect(.bounce, value: currentPage)

                        VStack(spacing: Spacing.sm) {
                            Text(slide.title)
                                .font(.hintoH1)
                                .multilineTextAlignment(.center)

                            Text(slide.description)
                                .font(.hintoBody)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, Spacing.xl)
                        }
                    }
                    .tag(index)
                    .padding(.top, Spacing.xxl)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .frame(maxHeight: .infinity)

            // Bottom: Auth buttons
            VStack(spacing: Spacing.sm) {
                Text("Get started")
                    .font(.hintoH3)

                Text("Choose your preferred sign-in method")
                    .font(.hintoBodySmall)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, Spacing.xs)

                ForEach(AuthProvider.allCases) { provider in
                    SocialAuthButton(provider: provider) {
                        Task { await handleAuth(provider) }
                    }
                    .disabled(isLoading)
                }

                #if DEBUG
                Button("Dev Sign In") {
                    auth.devSignIn()
                }
                .font(.hintoCaption)
                .foregroundStyle(.tertiary)
                .padding(.top, Spacing.xs)
                #endif
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xl)
        }
        .alert("Sign In Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "Something went wrong")
        }
    }

    private func handleAuth(_ provider: AuthProvider) async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await auth.signInWithProvider(provider)
        } catch AuthError.cancelled {
            // User cancelled, do nothing
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    OnboardingView()
        .environment(AuthManager())
}
