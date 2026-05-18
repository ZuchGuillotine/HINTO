import SwiftUI

struct OnboardingView: View {
    @Environment(AuthManager.self) private var auth
    @State private var currentPage = 0
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var showEmailSignIn = false
    @State private var authIntent: AuthIntent?

    private let slides: [(emoji: String, title: String, description: String)] = [
        ("💖", "Welcome to HINTO", "Navigate your dating life with clarity and get the truth about your situationships."),
        ("📊", "Rank Your People", "Add the people in your life and drag to reorder based on your priorities."),
        ("🤖", "HNNT", "Get private, personalized relationship advice 24/7 from HNNT."),
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

            // Bottom: intent gate or provider picker
            VStack(spacing: Spacing.sm) {
                if let intent = authIntent {
                    providerPicker(for: intent)
                } else {
                    intentGate
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xl)
            .animation(.easeInOut(duration: 0.2), value: authIntent)
        }
        .sheet(isPresented: $showEmailSignIn) {
            NavigationStack {
                EmailSignInView(intent: authIntent ?? .signIn)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showEmailSignIn = false }
                        }
                    }
            }
        }
        .alert("Sign In Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "Something went wrong")
        }
    }

    // MARK: - Intent gate

    private var intentGate: some View {
        VStack(spacing: Spacing.sm) {
            Text("Welcome to HINTO")
                .font(.hintoH3)

            Text("Sign in, or create a new account to get started")
                .font(.hintoBodySmall)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.xs)

            HINTOButton(title: "Create account", style: .primary, icon: "sparkles") {
                withAnimation { authIntent = .signUp }
            }

            HINTOButton(title: "Sign in", style: .secondary, icon: "person.fill") {
                withAnimation { authIntent = .signIn }
            }
        }
    }

    // MARK: - Provider picker

    private func providerPicker(for intent: AuthIntent) -> some View {
        VStack(spacing: Spacing.sm) {
            Text(intent.heading)
                .font(.hintoH3)

            Text(intent.subheading)
                .font(.hintoBodySmall)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.bottom, Spacing.xs)

            ForEach(AuthProvider.allCases) { provider in
                SocialAuthButton(provider: provider) {
                    Task { await handleAuth(provider) }
                }
                .disabled(isLoading)
            }

            Button("Use a different option") {
                withAnimation { authIntent = nil }
            }
            .font(.hintoCaption)
            .foregroundStyle(.secondary)
            .padding(.top, Spacing.xs)
            .disabled(isLoading)

            #if DEBUG
            VStack(spacing: Spacing.xs) {
                Button("Use Local API") {
                    Task { await handleLocalDevelopmentAuth() }
                }
                .font(.hintoCaption)
                .foregroundStyle(Color.hintoPink)

                Button("Preview Mode") {
                    auth.devSignIn()
                }
                .font(.hintoCaption)
                .foregroundStyle(.tertiary)
            }
            .padding(.top, Spacing.xs)
            #endif
        }
    }

    private func handleAuth(_ provider: AuthProvider) async {
        if provider == .email {
            showEmailSignIn = true
            return
        }

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

    private func handleLocalDevelopmentAuth() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await auth.signInForLocalDevelopment()
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
