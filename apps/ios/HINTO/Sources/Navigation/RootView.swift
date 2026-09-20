import SwiftUI

struct RootView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    var body: some View {
        Group {
            if auth.isLoading {
                launchScreen
            } else if auth.isAuthenticated {
                if auth.needsAgeConfirmation {
                    AgeConfirmationView()
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                } else {
                    MainTabView()
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                }
            } else {
                OnboardingView()
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
            }
        }
        .animation(.spring(response: 0.5), value: auth.isAuthenticated)
        .animation(.spring(response: 0.5), value: auth.needsAgeConfirmation)
        .animation(.easeOut(duration: 0.3), value: auth.isLoading)
        .task(id: auth.isAuthenticated) {
            guard auth.isAuthenticated else { return }
            await auth.refreshCurrentUser(using: api)
        }
    }

    private var launchScreen: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                Text("💖")
                    .font(.system(size: 64))

                Text("HINTO")
                    .font(.hintoDisplay)
                    .foregroundStyle(Color.hintoPink)

                ProgressView()
                    .padding(.top, Spacing.md)
            }
        }
    }
}

#Preview {
    RootView()
        .environment(AuthManager())
        .environment(APIClient())
}
