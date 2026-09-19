import SwiftUI

/// Public voting screen for an invite code, presented from a `hinto://vote/<code>`
/// or `https://hinto.app/vote/<code>` link. No sign-in is required: the API keys
/// votes on a stable per-device `voterIdentity`.
struct VotingView: View {
    let inviteCode: String

    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    @State private var aggregate: PublicVotingSessionAggregate?
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var bestPick: Situationship?
    @State private var worstPick: Situationship?
    @State private var comment = ""
    @State private var isSubmitting = false
    @State private var hasVoted = false
    @State private var errorMessage: String?
    @State private var showError = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    unavailableState(
                        title: "This link is not available",
                        message: loadError
                    )
                } else if hasVoted {
                    votedState
                } else if let aggregate {
                    if aggregate.capabilities.canVote, aggregate.items.count >= 2 {
                        votingContent(aggregate)
                    } else {
                        unavailableState(
                            title: "Voting has ended",
                            message: "This voting session is no longer accepting votes."
                        )
                    }
                }
            }
            .navigationTitle("Vote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(hasVoted ? "Done" : "Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
            }
            .task { await load() }
            .alert("Vote not submitted", isPresented: $showError) {
                Button("OK") {}
            } message: {
                Text(errorMessage ?? "Please try again.")
            }
        }
    }

    // MARK: - Voting

    private func votingContent(_ aggregate: PublicVotingSessionAggregate) -> some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                // Header
                VStack(spacing: Spacing.xs) {
                    Text("Cast Your Vote")
                        .font(.hintoH2)

                    Text("\(ownerName(aggregate)) wants your take. Pick the best fit and the one that's not it.")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.lg)

                    Label(aggregate.session.timeRemaining, systemImage: "clock")
                        .font(.hintoCaption)
                        .foregroundStyle(.tertiary)
                }
                .padding(.top, Spacing.md)

                // Best pick
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("Best Fit", systemImage: "heart.fill")
                        .font(.hintoH4)
                        .foregroundStyle(Color.hintoSuccess)

                    ForEach(aggregate.items) { item in
                        voteOption(item, selected: bestPick?.id == item.id, color: Color.hintoSuccess) {
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
                        .foregroundStyle(Color.hintoError)

                    ForEach(aggregate.items) { item in
                        voteOption(item, selected: worstPick?.id == item.id, color: Color.hintoError) {
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
                if aggregate.capabilities.canComment {
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
                }

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

                Text("Votes are anonymous. One vote per person per session.")
                    .font(.hintoCaption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
            .padding(.bottom, Spacing.xl)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var votedState: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 72))
                .foregroundStyle(Color.hintoSuccess.gradient)

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

    private func unavailableState(title: String, message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "link.badge.plus")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text(title)
                .font(.hintoH3)

            Text(message)
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)

            HINTOButton(title: "Close", style: .secondary) { dismiss() }
                .frame(maxWidth: 200)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
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

    private func ownerName(_ aggregate: PublicVotingSessionAggregate) -> String {
        let displayName = aggregate.ownerProfile.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return displayName.isEmpty ? "@\(aggregate.ownerProfile.username)" : displayName
    }

    // MARK: - Networking

    private func load() async {
        guard aggregate == nil else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await api.getPublicVotingSession(inviteCode: inviteCode)
            aggregate = response.data
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func submitVote() async {
        guard let best = bestPick, let worst = worstPick, best.id != worst.id else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        let trimmedComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = SubmitVoteRequest(
            voterIdentity: VoterIdentity.current,
            bestSituationshipId: best.id,
            worstSituationshipId: worst.id,
            comment: trimmedComment.isEmpty ? nil : trimmedComment
        )

        do {
            _ = try await api.submitVote(inviteCode: inviteCode, input: request)
            withAnimation(.spring) {
                hasVoted = true
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    VotingView(inviteCode: "PREVIEW")
        .environment(APIClient())
}
