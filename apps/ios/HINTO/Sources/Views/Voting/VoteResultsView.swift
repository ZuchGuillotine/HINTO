import SwiftUI

/// Owner-only results for one voting session (`GET /v1/me/voting-sessions/:id/results`).
/// Expects to be pushed or presented inside a `NavigationStack` supplied by the caller.
struct VoteResultsView: View {
    let votingSessionId: String

    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var aggregate: VoteResultsAggregate?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading && aggregate == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, aggregate == nil {
                failedState(errorMessage)
            } else if let aggregate, aggregate.totalVotes > 0 {
                resultsList(aggregate)
            } else {
                emptyState
            }
        }
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadResults() }
        .refreshable { await loadResults() }
    }

    private func resultsList(_ aggregate: VoteResultsAggregate) -> some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                // Summary card
                VStack(spacing: Spacing.xs) {
                    Text("\(aggregate.totalVoters)")
                        .font(.hintoDisplay)
                        .foregroundStyle(Color.hintoPink)

                    Text(aggregate.totalVoters == 1 ? "friend voted" : "friends voted")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)

                    Text(aggregate.session.status == .active ? aggregate.session.timeRemaining : "Voting closed")
                        .font(.hintoCaption)
                        .foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(Spacing.lg)
                .background(Color.hintoPink.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
                .padding(.horizontal, Spacing.md)

                // Individual results (server already ranks by score)
                ForEach(aggregate.results.sorted { $0.rank < $1.rank }) { result in
                    resultCard(result)
                }

                if !aggregate.comments.isEmpty {
                    commentsSection(aggregate)
                }
            }
            .padding(.vertical, Spacing.md)
        }
    }

    @ViewBuilder
    private func resultCard(_ result: VoteResult) -> some View {
        VStack(spacing: Spacing.sm) {
            HStack {
                // Rank + name
                HStack(spacing: Spacing.sm) {
                    ZStack {
                        Circle()
                            .fill(result.rank == 1 ? Color.hintoPink.gradient : Color.neutral300.gradient)
                            .frame(width: 32, height: 32)
                        Text("\(result.rank)")
                            .font(.hintoLabel)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                    }

                    Text(result.emoji ?? "💖")
                        .font(.title3)

                    Text(result.name)
                        .font(.hintoH5)
                }

                Spacer()

                // Score
                VStack(alignment: .trailing) {
                    Text(result.score > 0 ? "+\(result.score)" : "\(result.score)")
                        .font(.hintoH4)
                        .foregroundStyle(
                            result.score > 0
                                ? Color.hintoSuccess
                                : result.score < 0
                                    ? Color.hintoError
                                    : Color.secondary
                        )
                    Text("score")
                        .font(.hintoCaption)
                        .foregroundStyle(.tertiary)
                }
            }

            // Vote bars
            HStack(spacing: Spacing.sm) {
                // Best votes
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.hintoSuccess)
                        Text("\(result.bestVotes) best")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                    }

                    GeometryReader { geo in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.hintoSuccess.gradient)
                            .frame(width: geo.size.width * result.bestPercentage / 100)
                    }
                    .frame(height: 6)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                // Worst votes
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.hintoError)
                        Text("\(result.worstVotes) worst")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                    }

                    GeometryReader { geo in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.hintoError.gradient)
                            .frame(width: geo.size.width * result.worstPercentage / 100)
                    }
                    .frame(height: 6)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }
            }
        }
        .padding(Spacing.md)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
        .padding(.horizontal, Spacing.md)
    }

    private func commentsSection(_ aggregate: VoteResultsAggregate) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Comments")
                .font(.hintoH4)

            ForEach(aggregate.comments) { comment in
                VStack(alignment: .leading, spacing: Spacing.xxs) {
                    HStack(spacing: Spacing.xxs) {
                        Image(systemName: comment.isBestFit ? "heart.fill" : "xmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(comment.isBestFit ? Color.hintoSuccess : Color.hintoError)

                        Text(situationshipName(for: comment.situationshipId, in: aggregate))
                            .font(.hintoLabel)

                        Spacer()

                        if let voterLabel = comment.voterLabel, !voterLabel.isEmpty {
                            Text(voterLabel)
                                .font(.hintoCaption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Text(comment.comment)
                        .font(.hintoBody)
                }
                .padding(Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            }
        }
        .padding(.horizontal, Spacing.md)
    }

    private func situationshipName(for situationshipId: String, in aggregate: VoteResultsAggregate) -> String {
        aggregate.results.first { $0.situationshipId == situationshipId }?.name ?? "Someone"
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("No votes yet")
                .font(.hintoH3)

            Text("Share your link with friends. Pull down to refresh once they have voted.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("Could not load results")
                .font(.hintoH3)

            Text(message)
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            HINTOButton(title: "Try Again", style: .secondary, icon: "arrow.clockwise") {
                Task { await loadResults() }
            }
            .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    private func loadResults() async {
        guard let token = auth.accessToken else {
            errorMessage = AuthError.sessionExpired.errorDescription
            isLoading = false
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await api.getVotingResults(token: token, votingSessionId: votingSessionId)
            aggregate = response.data
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        VoteResultsView(votingSessionId: "preview")
            .environment(AuthManager())
            .environment(APIClient())
    }
}
