import SwiftUI

struct VotingView: View {
    let situationships: [Situationship]
    let sessionId: String

    @Environment(\.dismiss) private var dismiss
    @State private var bestPick: Situationship?
    @State private var worstPick: Situationship?
    @State private var comment = ""
    @State private var isSubmitting = false
    @State private var hasVoted = false

    var body: some View {
        NavigationStack {
            if hasVoted {
                votedState
            } else {
                votingContent
            }
        }
    }

    private var votingContent: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                // Header
                VStack(spacing: Spacing.xs) {
                    Text("Cast Your Vote")
                        .font(.hintoH2)

                    Text("Pick the best fit and the one that's not it")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, Spacing.md)

                // Best pick
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("Best Fit", systemImage: "heart.fill")
                        .font(.hintoH4)
                        .foregroundStyle(.hintoSuccess)

                    ForEach(situationships) { item in
                        voteOption(item, selected: bestPick?.id == item.id, color: .hintoSuccess) {
                            withAnimation(.spring(response: 0.3)) {
                                bestPick = item
                                if worstPick?.id == item.id { worstPick = nil }
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.md)

                // Worst pick
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("Not the One", systemImage: "xmark.circle.fill")
                        .font(.hintoH4)
                        .foregroundStyle(.hintoError)

                    ForEach(situationships) { item in
                        voteOption(item, selected: worstPick?.id == item.id, color: .hintoError) {
                            withAnimation(.spring(response: 0.3)) {
                                worstPick = item
                                if bestPick?.id == item.id { bestPick = nil }
                            }
                        }
                        .disabled(bestPick?.id == item.id)
                        .opacity(bestPick?.id == item.id ? 0.4 : 1)
                    }
                }
                .padding(.horizontal, Spacing.md)

                // Optional comment
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Leave a comment (optional)")
                        .font(.hintoLabel)
                        .foregroundStyle(.secondary)

                    TextField("Share your thoughts...", text: $comment, axis: .vertical)
                        .font(.hintoBody)
                        .lineLimit(2...4)
                        .padding(Spacing.sm)
                        .background(Color(.tertiarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
                }
                .padding(.horizontal, Spacing.md)

                // Submit
                HINTOButton(
                    title: "Submit Vote",
                    style: .primary,
                    icon: "checkmark.circle",
                    isLoading: isSubmitting
                ) {
                    Task { await submitVote() }
                }
                .disabled(bestPick == nil || worstPick == nil)
                .padding(.horizontal, Spacing.md)
            }
            .padding(.bottom, Spacing.xl)
        }
        .navigationTitle("Vote")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var votedState: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 72))
                .foregroundStyle(.hintoSuccess.gradient)
                .symbolEffect(.bounce)

            Text("Vote Submitted!")
                .font(.hintoH1)

            Text("Thanks for your input. The owner will see the results.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)

            Spacer()

            HINTOButton(title: "Done", style: .primary) { dismiss() }
                .padding(.horizontal, Spacing.lg)
        }
        .padding(.bottom, Spacing.xl)
    }

    @ViewBuilder
    private func voteOption(_ item: Situationship, selected: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                Text(item.displayEmoji)
                    .font(.title2)

                Text(item.name)
                    .font(.hintoBody)
                    .foregroundStyle(.primary)

                Spacer()

                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(color)
                        .font(.title3)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(Spacing.sm)
            .background(
                selected
                    ? color.opacity(0.1)
                    : Color(.tertiarySystemBackground)
            )
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            .overlay {
                if selected {
                    RoundedRectangle(cornerRadius: CornerRadius.md)
                        .strokeBorder(color, lineWidth: 2)
                }
            }
        }
        .sensoryFeedback(.selection, trigger: selected)
    }

    private func submitVote() async {
        guard let best = bestPick, let worst = worstPick else { return }
        isSubmitting = true

        // In production, this calls the API
        try? await Task.sleep(for: .seconds(1))

        withAnimation(.spring) {
            hasVoted = true
            isSubmitting = false
        }
    }
}

#Preview {
    VotingView(
        situationships: SituationshipListView.mockSituationships,
        sessionId: "preview"
    )
}
