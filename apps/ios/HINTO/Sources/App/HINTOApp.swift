import SwiftUI

@main
struct HINTOApp: App {
    @State private var authManager: AuthManager
    @State private var apiClient: APIClient
    @State private var pendingVoteInvite: VoteInviteLink?

    init() {
        let auth = AuthManager()
        let client = APIClient()
        client.authManager = auth
        _authManager = State(initialValue: auth)
        _apiClient = State(initialValue: client)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authManager)
                .environment(apiClient)
                .tint(Color.hintoPink)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .sheet(item: $pendingVoteInvite) { invite in
                    VotingView(inviteCode: invite.inviteCode)
                        .environment(authManager)
                        .environment(apiClient)
                }
        }
    }

    /// Handles `https://hnnt.app/vote/<code>` universal links and
    /// `hinto://vote/<code>` scheme links. Other URLs (for example the
    /// provider auth callback) are owned by their presenting session.
    private func handleIncomingURL(_ url: URL) {
        guard let invite = VoteInviteLink(url: url) else { return }
        pendingVoteInvite = invite
    }
}
