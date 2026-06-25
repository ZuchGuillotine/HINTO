import PhotosUI
import SwiftUI

struct FriendsFeedView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var items: [FeedItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isShowingComposer = false
    @State private var pendingDish: PendingFeedDish?
    @State private var voteCopyByItemId: [String: FeedVoteCopy] = [:]
    @State private var submittingVoteIds: Set<String> = []

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
            .navigationTitle("Rank")
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
            .sheet(item: $pendingDish) { pendingDish in
                FeedDishComposer(pendingDish: pendingDish) { comment in
                    await submitComment(
                        for: pendingDish.item,
                        comment: comment,
                        parentComment: pendingDish.parentComment
                    )
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
                    FeedItemCard(
                        item: item,
                        timeRemaining: timeRemaining,
                        voteControls: voteControls,
                        dishAction: openDishComposer
                    )
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
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
        let copy = voteCopy(for: item)
        let viewerBestFitCount = viewerVoteCount(.bestFit, for: item)
        let viewerNotTheOneCount = viewerVoteCount(.notTheOne, for: item)
        let voteSignal = voteSignal(for: summary)
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                Text("votes \(voteSignal.totalCount)")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)

                Text("·")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 3) {
                    Image(systemName: "flag.fill")
                    Text(voteSignal.netLabel)
                        .fontWeight(.semibold)
                }
                .font(.hintoCaption)
                .foregroundStyle(voteSignal.color)
            }

            HStack(spacing: Spacing.sm) {
                voteButton(
                    title: copy.bestFit,
                    systemImage: "heart.fill",
                    count: summary.bestFitCount,
                    selected: viewerBestFitCount > 0,
                    disabled: isClosed || item.submissionId == nil || isSubmittingVote(.bestFit, for: item)
                ) {
                    Task {
                        await submitQuickVote(.bestFit, for: item)
                    }
                }

                voteButton(
                    title: copy.notTheOne,
                    systemImage: "xmark",
                    count: summary.notTheOneCount,
                    selected: viewerNotTheOneCount > 0,
                    disabled: isClosed || item.submissionId == nil || isSubmittingVote(.notTheOne, for: item)
                ) {
                    Task {
                        await submitQuickVote(.notTheOne, for: item)
                    }
                }
            }
        }
    }

    private func voteButton(
        title: String,
        systemImage: String,
        count: Int,
        selected: Bool,
        disabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: systemImage)
                Text(title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: Spacing.xs)
                Text("\(count)")
                    .fontWeight(.semibold)
            }
            .font(.hintoCaption)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(selected ? .hintoPink : Color(.tertiarySystemFill))
        .foregroundStyle(selected ? Color.white : Color.primary)
        .disabled(disabled)
    }

    private func viewerVoteCount(_ voteType: FeedVoteType, for item: FeedItem) -> Int {
        if let viewerSummary = item.viewerVoteSummary {
            return voteType == .bestFit
                ? viewerSummary.bestFitCount
                : viewerSummary.notTheOneCount
        }

        if item.viewerVote == voteType {
            return item.viewerVoteCount ?? 0
        }

        return 0
    }

    private func voteSignal(for summary: FeedVoteSummary) -> FeedVoteSignal {
        let totalCount = summary.bestFitCount + summary.notTheOneCount
        let netScore = summary.bestFitCount - summary.notTheOneCount
        let color: Color

        if netScore > 0 {
            color = .hintoSuccess
        } else if Double(netScore) < -(Double(totalCount) * 0.2) {
            color = .hintoError
        } else {
            color = .hintoWarning
        }

        return FeedVoteSignal(
            totalCount: totalCount,
            netLabel: netScore > 0 ? "+\(netScore)" : "\(netScore)",
            color: color
        )
    }

    private func openDishComposer(for item: FeedItem) {
        pendingDish = PendingFeedDish(item: item, parentComment: nil)
    }

    private func openDishComposer(for item: FeedItem, parentComment: FeedSubmissionComment?) {
        pendingDish = PendingFeedDish(item: item, parentComment: parentComment)
    }

    private func loadFeed() async {
        guard let token = auth.accessToken else { return }
        isLoading = items.isEmpty
        errorMessage = nil

        do {
            let response = try await api.getFriendsFeed(token: token)
            let nextItems = response.data.items
            syncVoteCopy(for: nextItems)
            withAnimation {
                items = nextItems
                isLoading = false
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func submitQuickVote(_ voteType: FeedVoteType, for item: FeedItem) async {
        let voteId = voteSubmissionId(voteType, for: item)
        submittingVoteIds.insert(voteId)
        await submitVote(voteType, for: item, count: 1, comment: nil)
        submittingVoteIds.remove(voteId)
    }

    private func submitVote(
        _ voteType: FeedVoteType,
        for item: FeedItem,
        count: Int,
        comment: String?
    ) async {
        guard let token = auth.accessToken,
              let submissionId = item.submissionId else { return }

        do {
            _ = try await api.voteOnFeedSubmission(
                token: token,
                submissionId: submissionId,
                input: VoteOnFeedSubmissionRequest(voteType: voteType, comment: comment, count: count)
            )
            await loadFeed()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func submitComment(
        for item: FeedItem,
        comment: String,
        parentComment: FeedSubmissionComment?
    ) async {
        guard let token = auth.accessToken,
              let submissionId = item.submissionId else { return }

        do {
            _ = try await api.commentOnFeedSubmission(
                token: token,
                submissionId: submissionId,
                input: CreateFeedSubmissionCommentRequest(
                    comment: comment,
                    parentCommentId: parentComment?.commentId
                )
            )
            await loadFeed()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func isSubmittingVote(_ voteType: FeedVoteType, for item: FeedItem) -> Bool {
        submittingVoteIds.contains(voteSubmissionId(voteType, for: item))
    }

    private func voteSubmissionId(_ voteType: FeedVoteType, for item: FeedItem) -> String {
        "\(item.id):\(voteType.rawValue)"
    }

    private func voteCopy(for item: FeedItem) -> FeedVoteCopy {
        voteCopyByItemId[item.id] ?? FeedVoteCopy.random()
    }

    private func syncVoteCopy(for nextItems: [FeedItem]) {
        let nextIds = Set(nextItems.map(\.id))
        voteCopyByItemId = voteCopyByItemId.filter { nextIds.contains($0.key) }

        for item in nextItems where voteCopyByItemId[item.id] == nil {
            voteCopyByItemId[item.id] = FeedVoteCopy.random()
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

private struct PendingFeedDish: Identifiable {
    let item: FeedItem
    let parentComment: FeedSubmissionComment?

    var id: String {
        parentComment.map { "\(item.id):\($0.commentId)" } ?? item.id
    }
}

private struct FeedVoteSignal {
    let totalCount: Int
    let netLabel: String
    let color: Color
}

private struct FeedVoteCopy {
    let bestFit: String
    let notTheOne: String

    static func random() -> FeedVoteCopy {
        FeedVoteCopy(
            bestFit: bestFitOptions.randomElement() ?? "Best fit",
            notTheOne: notTheOneOptions.randomElement() ?? "Not it"
        )
    }

    private static let bestFitOptions = [
        "Best fit",
        "Do it girl",
        "Omg cute",
        "Green flag",
        "Ship it",
        "Yes please",
        "Main character"
    ]

    private static let notTheOneOptions = [
        "Not it",
        "Chud",
        "Hard pass",
        "Red flag",
        "Nope",
        "The ick",
        "Run"
    ]
}

private struct FeedItemCard<VoteControls: View>: View {
    let item: FeedItem
    let timeRemaining: (String) -> String
    let voteControls: (FeedItem, FeedVoteSummary) -> VoteControls
    let dishAction: (FeedItem, FeedSubmissionComment?) -> Void

    @State private var showsAllComments = false

    private let mediaHeight: CGFloat = 104
    private let bodyHeight: CGFloat = 42

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            authorRow
            subjectRow
            captionBlock
            mediaBlock
            dishButton
            commentPreviewBlock

            if let summary = item.voteSummary {
                voteControls(item, summary)
            } else {
                EmptyView()
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
    }

    private var authorRow: some View {
        HStack(spacing: Spacing.sm) {
            AvatarView(url: item.ownerProfile.avatarUrl, emoji: nil, size: 32)

            VStack(alignment: .leading, spacing: 1) {
                Text(item.ownerProfile.displayName)
                    .font(.hintoLabel)
                    .lineLimit(1)

                Text("@\(item.ownerProfile.username)")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: Spacing.sm)

            if let submission = item.submission {
                Text(submission.status == .active ? timeRemaining(submission.expiresAt) : "Closed")
                    .font(.hintoCaption)
                    .foregroundStyle(submission.status == .active ? Color.secondary : Color.hintoError)
                    .lineLimit(1)
            }
        }
        .frame(height: 34)
    }

    private var subjectRow: some View {
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

                Text(item.situationship.category ?? "Situationship")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()
        }
        .frame(height: 46)
    }

    private var captionBlock: some View {
        Text(hasCaption ? captionText : " ")
            .font(.hintoBody)
            .foregroundStyle(hasCaption ? Color.primary : Color.clear)
            .lineLimit(2)
            .frame(maxWidth: .infinity, minHeight: bodyHeight, maxHeight: bodyHeight, alignment: .topLeading)
            .clipped()
    }

    private var captionText: String {
        item.submission?.body ?? ""
    }

    private var hasCaption: Bool {
        !captionText.isEmpty
    }

    @ViewBuilder
    private var mediaBlock: some View {
        if let imageUrl = item.submission?.imageUrl,
           let url = URL(string: imageUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    Image(systemName: "photo")
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                @unknown default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: mediaHeight)
            .background(Color(.tertiarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            .clipped()
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: CornerRadius.md)
                    .fill(Color(.tertiarySystemBackground))

                Image(systemName: "person.2.wave.2")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(Color.hintoPink.opacity(0.55))
            }
            .frame(maxWidth: .infinity)
            .frame(height: mediaHeight)
        }
    }

    private var dishButton: some View {
        Button {
            dishAction(item, nil)
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 15, weight: .semibold))

                Text("dish")
                    .font(.hintoBodySmall)

                Spacer(minLength: 0)
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, Spacing.sm)
            .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
            .background(Color(.tertiarySystemBackground))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(item.submission?.status == .concluded || item.submissionId == nil)
    }

    @ViewBuilder
    private var commentPreviewBlock: some View {
        let comments = item.comments ?? []
        if comments.isEmpty {
            EmptyView()
        } else {
            let displayedComments = visibleComments(from: comments)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                ForEach(displayedComments) { displayedComment in
                    commentRow(displayedComment)
                }

                if flattenedComments(from: comments).count > 3 {
                    Button {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            showsAllComments.toggle()
                        }
                    } label: {
                        Text(showsAllComments ? "less tea" : "tea")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
    }

    private func visibleComments(from comments: [FeedSubmissionComment]) -> [FeedDisplayedComment] {
        let flattened = flattenedComments(from: comments)
        return showsAllComments ? flattened : Array(flattened.prefix(3))
    }

    private func flattenedComments(from comments: [FeedSubmissionComment]) -> [FeedDisplayedComment] {
        let grouped = Dictionary(grouping: comments, by: { $0.parentCommentId })
        let roots = grouped[nil] ?? []
        var displayed: [FeedDisplayedComment] = []

        func append(_ comment: FeedSubmissionComment, depth: Int) {
            displayed.append(FeedDisplayedComment(comment: comment, depth: min(depth, 3)))
            for reply in grouped[comment.commentId] ?? [] {
                append(reply, depth: depth + 1)
            }
        }

        for comment in roots {
            append(comment, depth: 0)
        }

        return displayed
    }

    private func commentRow(_ displayedComment: FeedDisplayedComment) -> some View {
        let comment = displayedComment.comment
        return HStack(alignment: .top, spacing: Spacing.xs) {
            AvatarView(url: comment.voterProfile.avatarUrl, emoji: nil, size: 22)

            VStack(alignment: .leading, spacing: 1) {
                Text(comment.comment)
                    .font(.hintoBodySmall)
                    .lineLimit(1)

                HStack(spacing: Spacing.xs) {
                    Text(comment.voterProfile.displayName)
                        .foregroundStyle(.secondary)

                    if let voteBadge = commentVoteBadge(for: comment) {
                        HStack(spacing: 2) {
                            Image(systemName: voteBadge.systemImage)
                            Text(voteBadge.countLabel)
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(voteBadge.color)
                    }

                    Button("reply") {
                        dishAction(item, comment)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
                .font(.hintoCaption)
                .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(displayedComment.depth) * 18)
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private func commentVoteBadge(for comment: FeedSubmissionComment) -> CommentVoteBadge? {
        guard let voteType = comment.voteType, comment.voterVoteCount > 0 else {
            return nil
        }

        switch voteType {
        case .bestFit:
            return CommentVoteBadge(
                systemImage: "arrow.up",
                countLabel: "+\(comment.voterVoteCount)",
                color: .hintoSuccess
            )
        case .notTheOne:
            return CommentVoteBadge(
                systemImage: "arrow.down",
                countLabel: "-\(comment.voterVoteCount)",
                color: .hintoError
            )
        }
    }
}

private struct FeedDisplayedComment: Identifiable {
    let comment: FeedSubmissionComment
    let depth: Int

    var id: String { comment.id }
}

private struct CommentVoteBadge {
    let systemImage: String
    let countLabel: String
    let color: Color
}

private struct FeedDishComposer: View {
    @Environment(\.dismiss) private var dismiss

    let pendingDish: PendingFeedDish
    let onSubmit: (String) async -> Void

    @State private var comment = ""
    @State private var isSubmitting = false

    private var trimmedComment: String {
        comment.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var sectionTitle: String {
        pendingDish.parentComment == nil ? "Dish" : "Reply"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(sectionTitle) {
                    if let parentComment = pendingDish.parentComment {
                        Text("Replying to \(parentComment.voterProfile.displayName)")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                    }

                    TextEditor(text: $comment)
                        .frame(minHeight: 90)

                    Text("\(trimmedComment.count)/140")
                        .font(.hintoCaption)
                        .foregroundStyle(trimmedComment.count > 140 ? Color.hintoError : Color.secondary)
                }
            }
            .navigationTitle("Dish")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Sending" : "Send") {
                        Task {
                            await submit()
                        }
                    }
                    .disabled(isSubmitting || trimmedComment.isEmpty || trimmedComment.count > 140)
                }
            }
        }
    }

    private func submit() async {
        guard !isSubmitting else { return }
        isSubmitting = true

        await onSubmit(trimmedComment)
        dismiss()
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
