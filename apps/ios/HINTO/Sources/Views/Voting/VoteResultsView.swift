import SwiftUI

struct VoteResultsView: View {
    let situationships: [Situationship]

    @State private var results: [VoteResult] = []
    @State private var totalVoters = 0
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if results.isEmpty {
                    emptyState
                } else {
                    resultsList
                }
            }
            .navigationTitle("Results")
            .navigationBarTitleDisplayMode(.inline)
            .task { await loadResults() }
        }
    }

    private var resultsList: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                // Summary card
                VStack(spacing: Spacing.xs) {
                    Text("\(totalVoters)")
                        .font(.hintoDisplay)
                        .foregroundStyle(.hintoPink)

                    Text("friends voted")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(Spacing.lg)
                .background(Color.hintoPink.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
                .padding(.horizontal, Spacing.md)

                // Individual results
                ForEach(Array(results.sorted { $0.score > $1.score }.enumerated()), id: \.element.id) { index, result in
                    resultCard(result, rank: index + 1)
                }
            }
            .padding(.vertical, Spacing.md)
        }
    }

    @ViewBuilder
    private func resultCard(_ result: VoteResult, rank: Int) -> some View {
        VStack(spacing: Spacing.sm) {
            HStack {
                // Rank + name
                HStack(spacing: Spacing.sm) {
                    ZStack {
                        Circle()
                            .fill(rank == 1 ? Color.hintoPink.gradient : Color.neutral300.gradient)
                            .frame(width: 32, height: 32)
                        Text("\(rank)")
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
                        .foregroundStyle(result.score > 0 ? .hintoSuccess : result.score < 0 ? .hintoError : .secondary)
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
                            .foregroundStyle(.hintoSuccess)
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
                            .foregroundStyle(.hintoError)
                        Text("\(result.worstVotes) worst")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                    }

                    GeometryReader { geo in
                        let worstPct = result.totalVotes > 0
                            ? Double(result.worstVotes) / Double(result.totalVotes) * 100
                            : 0
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.hintoError.gradient)
                            .frame(width: geo.size.width * worstPct / 100)
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

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("No votes yet")
                .font(.hintoH3)

            Text("Share your list with friends to start getting votes")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.xl)
    }

    private func loadResults() async {
        // In production, fetch from API
        try? await Task.sleep(for: .seconds(0.5))

        // Mock results
        results = situationships.map { s in
            let best = Int.random(in: 0...8)
            let worst = Int.random(in: 0...5)
            return VoteResult(
                situationshipId: s.id,
                name: s.name,
                emoji: s.displayEmoji,
                bestVotes: best,
                worstVotes: worst,
                totalVotes: best + worst
            )
        }
        totalVoters = Int.random(in: 3...12)
        isLoading = false
    }
}

#Preview {
    VoteResultsView(situationships: SituationshipListView.mockSituationships)
}
