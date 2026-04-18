import SwiftUI

struct VotingView: View {
    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    let inviteCode: String

    @AppStorage("hinto_voter_identity") private var voterIdentity = UUID().uuidString
    @State private var session: PublicVotingSessionAggregate?
    @State private var bestPick: Situationship?
    @State private var worstPick: Situationship?
    @State private var voterName = ""
    @State private var comment = ""
    @State private var isLoading = true
    @State private var isSubmitting = false
    @State private var hasVoted = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if hasVoted {
                votedState
            } else if let session, session.capabilities.canVote {
                votingContent(session: session)
            } else {
                unavailableState
            }
        }
        .task {
            await loadVotingSession()
        }
    }

    private func votingContent(session: PublicVotingSessionAggregate) -> some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                VStack(spacing: Spacing.xs) {
                    Text("Cast Your Vote")
                        .font(.hintoH2)

                    Text("Pick the best fit and the one that's not it")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)

                    Text("for \(session.ownerProfile.displayName)")
                        .font(.hintoCaption)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, Spacing.md)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("Best Fit", systemImage: "heart.fill")
                        .font(.hintoH4)
                        .foregroundStyle(Color.hintoSuccess)

                    ForEach(session.items) { item in
                        voteOption(item, selected: bestPick?.id == item.id, color: .hintoSuccess) {
                            withAnimation(.spring(response: 0.3)) {
                                bestPick = item
                                if worstPick?.id == item.id { worstPick = nil }
                            }
                        }
                    }
                }
                .padding(.horizontal, Spacing.md)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("Not the One", systemImage: "xmark.circle.fill")
                        .font(.hintoH4)
                        .foregroundStyle(Color.hintoError)

                    ForEach(session.items) { item in
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

                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Your name (optional)")
                        .font(.hintoLabel)
                        .foregroundStyle(.secondary)

                    TextField("Anonymous voter", text: $voterName)
                        .font(.hintoBody)
                        .padding(Spacing.sm)
                        .background(Color(.tertiarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
                }
                .padding(.horizontal, Spacing.md)

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
        .alert("Vote", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
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

    private var unavailableState: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 52))
                .foregroundStyle(.tertiary)

            Text("Voting unavailable")
                .font(.hintoH3)

            Text(errorMessage ?? "This voting session is no longer accepting votes.")
                .font(.hintoBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
        }
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

    private func submitVote() async {
        guard let bestPick, let worstPick else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let response = try await api.submitVote(
                inviteCode: inviteCode,
                input: SubmitVoteRequest(
                    voterIdentity: voterIdentity,
                    voterName: voterName.isEmpty ? nil : voterName,
                    bestSituationshipId: bestPick.id,
                    worstSituationshipId: worstPick.id,
                    comment: comment.isEmpty ? nil : comment
                )
            )

            if response.data.accepted {
                withAnimation(.spring) {
                    hasVoted = true
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadVotingSession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await api.getPublicVotingSession(inviteCode: inviteCode)
            session = response.data
            errorMessage = nil
        } catch {
            session = nil
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    VotingView(inviteCode: "PREVIEW")
        .environment(APIClient())
}
