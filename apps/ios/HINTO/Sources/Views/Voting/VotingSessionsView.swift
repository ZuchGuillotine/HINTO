import SwiftUI

struct VotingSessionsView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var sessions: [VotingSession] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if sessions.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(sessions) { session in
                        NavigationLink {
                            VoteResultsView(votingSessionId: session.votingSessionId)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(session.title)
                                    .font(.hintoBody)
                                    .fontWeight(.medium)

                                HStack(spacing: Spacing.sm) {
                                    Text(session.inviteCode)
                                        .font(.hintoCaption)
                                        .foregroundStyle(.secondary)

                                    Text(session.status.rawValue.capitalized)
                                        .font(.hintoCaption)
                                        .foregroundStyle(session.status == .active ? Color.hintoSuccess : .secondary)

                                    Text(session.timeRemaining)
                                        .font(.hintoCaption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Voting Sessions")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadSessions()
        }
        .refreshable {
            await loadSessions()
        }
        .alert("Voting Sessions", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "square.and.arrow.up.circle")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("No voting sessions yet")
                .font(.hintoH3)

            Text("Create a voting session from your situationship list, then come back here to review results.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.xl)
    }

    private func loadSessions() async {
        guard let token = auth.accessToken else {
            isLoading = false
            errorMessage = "Sign in is required before viewing voting sessions."
            return
        }

        isLoading = true

        do {
            let response = try await api.getVotingSessions(token: token)
            sessions = response.data.sessions
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

#Preview {
    NavigationStack {
        VotingSessionsView()
            .environment(AuthManager())
            .environment(APIClient())
    }
}
