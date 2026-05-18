import PhotosUI
import SwiftUI

struct FriendsFeedView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var items: [FeedItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isShowingComposer = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if items.isEmpty {
                    emptyState
                } else {
                    feedList
                }
            }
            .navigationTitle("Friends")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingComposer = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Create feed submission")
                }
            }
            .sheet(isPresented: $isShowingComposer) {
                FeedSubmissionComposer {
                    await loadFeed()
                }
            }
            .refreshable {
                await loadFeed()
            }
            .task {
                await loadFeed()
            }
        }
    }

    private var feedList: some View {
        List {
            Section {
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        HStack(spacing: Spacing.sm) {
                            AvatarView(url: item.ownerProfile.avatarUrl, emoji: nil, size: 32)

                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.ownerProfile.displayName)
                                    .font(.hintoLabel)

                                Text("@\(item.ownerProfile.username)")
                                    .font(.hintoCaption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if let submission = item.submission {
                                Text(submission.status == .active ? timeRemaining(until: submission.expiresAt) : "Closed")
                                    .font(.hintoCaption)
                                    .foregroundStyle(submission.status == .active ? Color.secondary : Color.hintoError)
                            }
                        }

                        HStack(spacing: Spacing.sm) {
                            AvatarView(
                                url: item.situationship.avatarUrl,
                                emoji: item.situationship.displayEmoji,
                                size: 44
                            )

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.situationship.name)
                                    .font(.hintoH5)
                                    .lineLimit(1)

                                if let category = item.situationship.category {
                                    Text(category)
                                        .font(.hintoCaption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()
                        }

                        if let body = item.submission?.body, !body.isEmpty {
                            Text(body)
                                .font(.hintoBody)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if let imageUrl = item.submission?.imageUrl,
                           let url = URL(string: imageUrl) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .empty:
                                    ProgressView()
                                        .frame(maxWidth: .infinity, minHeight: 180)
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFill()
                                        .frame(maxWidth: .infinity)
                                        .frame(height: 220)
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                                        .clipped()
                                case .failure:
                                    Image(systemName: "photo")
                                        .font(.system(size: 28))
                                        .foregroundStyle(.secondary)
                                        .frame(maxWidth: .infinity, minHeight: 180)
                                        .background(Color(.tertiarySystemBackground))
                                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                                @unknown default:
                                    EmptyView()
                                }
                            }
                        }

                        if let summary = item.voteSummary {
                            voteControls(for: item, summary: summary)
                        }
                    }
                    .padding(Spacing.md)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
            } header: {
                Text("\(items.count) feed submission\(items.count == 1 ? "" : "s")")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
                    .textCase(nil)
            }
        }
        .listStyle(.plain)
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "person.2")
                .font(.system(size: 64))
                .foregroundStyle(Color.hintoPink.gradient)

            VStack(spacing: Spacing.xs) {
                Text("No friend activity yet")
                    .font(.hintoH3)

                Text("Tap + to submit one of your situationships for friend votes.")
                    .font(.hintoBody)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.hintoCaption)
                    .foregroundStyle(Color.hintoError)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.lg)
            }
        }
        .padding(Spacing.xl)
    }

    @ViewBuilder
    private func voteControls(for item: FeedItem, summary: FeedVoteSummary) -> some View {
        let isClosed = item.submission?.status == .concluded
        HStack(spacing: Spacing.sm) {
            voteButton(
                title: "Best fit",
                systemImage: "heart.fill",
                count: summary.bestFitCount,
                selected: item.viewerVote == .bestFit,
                disabled: isClosed || item.submissionId == nil
            ) {
                await submitVote(.bestFit, for: item)
            }

            voteButton(
                title: "Not it",
                systemImage: "xmark",
                count: summary.notTheOneCount,
                selected: item.viewerVote == .notTheOne,
                disabled: isClosed || item.submissionId == nil
            ) {
                await submitVote(.notTheOne, for: item)
            }
        }
    }

    private func voteButton(
        title: String,
        systemImage: String,
        count: Int,
        selected: Bool,
        disabled: Bool,
        action: @escaping () async -> Void
    ) -> some View {
        Button {
            Task {
                await action()
            }
        } label: {
            Label("\(title) \(count)", systemImage: systemImage)
                .font(.hintoCaption)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(selected ? .hintoPink : Color(.tertiarySystemFill))
        .foregroundStyle(selected ? Color.white : Color.primary)
        .disabled(disabled)
    }

    private func loadFeed() async {
        guard let token = auth.accessToken else { return }
        isLoading = items.isEmpty
        errorMessage = nil

        do {
            let response = try await api.getFriendsFeed(token: token)
            withAnimation {
                items = response.data.items
                isLoading = false
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func submitVote(_ voteType: FeedVoteType, for item: FeedItem) async {
        guard let token = auth.accessToken,
              let submissionId = item.submissionId else { return }

        do {
            _ = try await api.voteOnFeedSubmission(
                token: token,
                submissionId: submissionId,
                input: VoteOnFeedSubmissionRequest(voteType: voteType, comment: nil)
            )
            await loadFeed()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func timeRemaining(until isoString: String) -> String {
        guard let date = ISO8601DateFormatter.hinto.date(from: isoString) else {
            return "Open"
        }

        let seconds = Int(date.timeIntervalSinceNow)
        if seconds <= 0 {
            return "Closed"
        }

        let hours = seconds / 3600
        if hours >= 24 {
            return "\(hours / 24)d left"
        }
        if hours >= 1 {
            return "\(hours)h left"
        }
        return "\(max(seconds / 60, 1))m left"
    }
}

private struct FeedSubmissionComposer: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    let onSubmitted: () async -> Void

    @State private var situationships: [Situationship] = []
    @State private var selectedSituationshipId: String?
    @State private var submissionBody = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var timeout = FeedTimeoutOption.oneDay
    @State private var isLoadingSituationships = true
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var bodyViewIsEmpty: Bool {
        submissionBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var canSubmit: Bool {
        selectedSituationshipId != nil &&
        (!bodyViewIsEmpty || selectedPhoto != nil) &&
        !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Situationship") {
                    if isLoadingSituationships {
                        ProgressView()
                    } else if situationships.isEmpty {
                        Text("Create a situationship first.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Pick one", selection: $selectedSituationshipId) {
                            ForEach(situationships) { item in
                                Text("\(item.displayEmoji) \(item.name)")
                                    .tag(Optional(item.id))
                            }
                        }
                    }
                }

                Section("Submission") {
                    TextEditor(text: $submissionBody)
                        .frame(minHeight: 120)

                    PhotosPicker(selection: $selectedPhoto, matching: .images) {
                        Label(
                            selectedPhoto == nil ? "Add image" : "Change image",
                            systemImage: "photo"
                        )
                    }
                }

                Section("Voting window") {
                    Picker("Ends after", selection: $timeout) {
                        ForEach(FeedTimeoutOption.allCases) { option in
                            Text(option.title).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.hintoCaption)
                            .foregroundStyle(Color.hintoError)
                    }
                }
            }
            .navigationTitle("Submit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Submitting" : "Post") {
                        Task {
                            await submit()
                        }
                    }
                    .disabled(!canSubmit)
                }
            }
            .task {
                await loadSituationships()
            }
        }
    }

    private func loadSituationships() async {
        guard let token = auth.accessToken else { return }

        do {
            let response = try await api.getSituationships(token: token)
            situationships = response.data.items.filter { $0.status == .active }
            selectedSituationshipId = selectedSituationshipId ?? situationships.first?.id
            isLoadingSituationships = false
        } catch {
            errorMessage = error.localizedDescription
            isLoadingSituationships = false
        }
    }

    private func submit() async {
        guard let token = auth.accessToken,
              let selectedSituationshipId else { return }

        isSubmitting = true
        errorMessage = nil

        do {
            let trimmedBody = submissionBody.trimmingCharacters(in: .whitespacesAndNewlines)
            let created = try await api.createFeedSubmission(
                token: token,
                input: CreateFeedSubmissionRequest(
                    situationshipId: selectedSituationshipId,
                    body: trimmedBody.isEmpty ? nil : trimmedBody,
                    expiresInHours: timeout.hours
                )
            )

            if let imageData = try await loadJPEGUploadData(from: selectedPhoto) {
                _ = try await api.uploadFeedSubmissionImage(
                    token: token,
                    submissionId: created.data.submission.submissionId,
                    imageData: imageData
                )
            }

            await onSubmitted()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isSubmitting = false
        }
    }
}

private enum FeedTimeoutOption: Int, CaseIterable, Identifiable {
    case oneHour = 1
    case sixHours = 6
    case oneDay = 24
    case threeDays = 72

    var id: Int { rawValue }

    var hours: Int { rawValue }

    var title: String {
        switch self {
        case .oneHour: "1h"
        case .sixHours: "6h"
        case .oneDay: "24h"
        case .threeDays: "3d"
        }
    }
}

private extension ISO8601DateFormatter {
    static let hinto: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

#Preview {
    FriendsFeedView()
        .environment(AuthManager())
        .environment(APIClient())
}
