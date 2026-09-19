import SwiftUI

struct RootView: View {
    @Environment(AuthManager.self) private var auth
    @State private var pendingVoteInvite: VoteInvite?

    var body: some View {
        Group {
            if auth.isLoading {
                launchScreen
            } else if auth.isAuthenticated {
                if auth.needsAgeConfirmation {
                    AgeConfirmationView()
                        .transition(.opacity)
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
        .animation(.easeOut(duration: 0.3), value: auth.isLoading)
        .animation(.easeOut(duration: 0.3), value: auth.needsAgeConfirmation)
        // Handles `hinto://vote/<code>` and `https://hinto.app/vote/<code>` (see DeepLink).
        // Voting is public, so the sheet is available whether or not the user is signed in.
        .onOpenURL { url in
            if let code = DeepLink.voteInviteCode(from: url) {
                pendingVoteInvite = VoteInvite(code: code)
            }
        }
        .sheet(item: $pendingVoteInvite) { invite in
            VotingView(inviteCode: invite.code)
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

/// Identifiable wrapper so an invite code can drive `.sheet(item:)`.
struct VoteInvite: Identifiable, Equatable {
    let code: String
    var id: String { code }
}

#Preview {
    RootView()
        .environment(AuthManager())
        .environment(APIClient())
}
