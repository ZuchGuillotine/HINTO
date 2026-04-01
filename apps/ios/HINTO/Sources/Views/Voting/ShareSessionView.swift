import SwiftUI

struct ShareSessionView: View {
    @Environment(\.dismiss) private var dismiss
    let situationships: [Situationship]

    @State private var isCreating = false
    @State private var shareURL: URL?
    @State private var showShareLink = false

    var body: some View {
        NavigationStack {
            VStack(spacing: Spacing.lg) {
                // Header illustration
                VStack(spacing: Spacing.sm) {
                    Image(systemName: "person.2.wave.2.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(.hintoPink.gradient)
                        .symbolEffect(.variableColor.iterative)

                    Text("Share with Friends")
                        .font(.hintoH2)

                    Text("Let your friends vote on your situationships. They'll pick their Best Fit and Not the One.")
                        .font(.hintoBody)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.lg)
                }
                .padding(.top, Spacing.xl)

                // Preview of what will be shared
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text("Your list (\(situationships.count))")
                        .font(.hintoLabel)
                        .foregroundStyle(.secondary)

                    ForEach(situationships.prefix(5)) { item in
                        HStack(spacing: Spacing.sm) {
                            Text(item.displayEmoji)
                                .font(.title3)
                            Text(item.name)
                                .font(.hintoBody)
                            Spacer()
                        }
                        .padding(.vertical, Spacing.xxs)
                    }

                    if situationships.count > 5 {
                        Text("+ \(situationships.count - 5) more")
                            .font(.hintoCaption)
                            .foregroundStyle(.tertiary)
                    }
                }
                .padding(Spacing.md)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
                .padding(.horizontal, Spacing.md)

                Spacer()

                // Share details
                VStack(spacing: Spacing.xs) {
                    Label("Link expires in 48 hours", systemImage: "clock")
                        .font(.hintoCaption)
                        .foregroundStyle(.secondary)

                    Label("Friends vote anonymously", systemImage: "eye.slash")
                        .font(.hintoCaption)
                        .foregroundStyle(.secondary)
                }

                if let shareURL {
                    ShareLink(item: shareURL, message: Text("Vote on my situationships! This link expires in 48 hours.")) {
                        Label("Share Link", systemImage: "square.and.arrow.up")
                            .font(.hintoButton)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .foregroundStyle(.white)
                            .background(Color.hintoPink)
                            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                    }
                    .padding(.horizontal, Spacing.md)
                } else {
                    HINTOButton(
                        title: "Create Voting Session",
                        style: .primary,
                        icon: "link.badge.plus",
                        isLoading: isCreating
                    ) {
                        Task { await createSession() }
                    }
                    .padding(.horizontal, Spacing.md)
                    .disabled(situationships.count < 2)
                }

                if situationships.count < 2 {
                    Text("Add at least 2 situationships to create a voting session")
                        .font(.hintoCaption)
                        .foregroundStyle(.hintoError)
                }
            }
            .padding(.bottom, Spacing.lg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func createSession() async {
        isCreating = true
        defer { isCreating = false }

        // In production, this would call the API to create a voting session
        // and get back an invite code
        try? await Task.sleep(for: .seconds(1))

        let mockCode = UUID().uuidString.prefix(8).lowercased()
        shareURL = URL(string: "https://hinto.app/vote/\(mockCode)")
    }
}

#Preview {
    ShareSessionView(situationships: SituationshipListView.mockSituationships)
}
