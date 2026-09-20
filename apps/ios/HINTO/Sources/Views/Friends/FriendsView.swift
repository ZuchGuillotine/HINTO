import Contacts
import SwiftUI

struct FriendsView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var friends: [Friendship] = []
    @State private var incomingRequests: [Friendship] = []
    @State private var outgoingRequests: [Friendship] = []
    @State private var suggestions: [FriendSuggestion] = []
    @State private var username = ""
    @State private var contactQuery = ""
    @State private var contacts: [InviteContact] = []
    @State private var contactAuthorization: CNAuthorizationStatus = CNContactStore.authorizationStatus(for: .contacts)
    @State private var selectedShareText: ShareTextItem?
    @State private var isLoading = false
    @State private var isSendingRequest = false
    @State private var errorMessage: String?

    private let contactStore = CNContactStore()

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: Spacing.lg) {
                    invitePanel
                    requestsPanel
                    friendsPanel
                    suggestionsPanel
                }
                .padding(Spacing.screenPadding)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Friends")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }
            }
            .task {
                await refresh()
            }
            .alert("Friends", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(item: $selectedShareText) { item in
                ShareLink(item: item.text) {
                    Label("Send Invite", systemImage: "square.and.arrow.up")
                        .font(.hintoButton)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(.white)
                        .background(Color.hintoPink)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                        .padding()
                }
                .presentationDetents([.height(140)])
            }
        }
    }

    private var invitePanel: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Invite friends")
                    .font(.hintoH4)
                Text("Search contacts locally or send a request by username.")
                    .font(.hintoBodySmall)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: Spacing.sm) {
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search iPhone contacts", text: $contactQuery)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()

                    if contactAuthorization == .notDetermined || contacts.isEmpty {
                        Button("Load") {
                            Task { await loadContacts() }
                        }
                        .font(.hintoButtonSmall)
                        .foregroundStyle(Color.hintoPink)
                    }
                }
                .padding(Spacing.md)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

                if !contactQuery.isEmpty {
                    let matches = filteredContacts
                    if matches.isEmpty {
                        Text("No contact matches")
                            .font(.hintoCaption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ForEach(matches.prefix(5)) { contact in
                            ContactInviteRow(contact: contact) {
                                Task { await createInviteShare(for: contact) }
                            }
                        }
                    }
                }
            }

            Divider()

            HStack(spacing: Spacing.sm) {
                TextField("@username", text: $username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(Spacing.md)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

                Button {
                    Task { await sendUsernameRequest() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.hintoPink)
                .disabled(isSendingRequest || username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(Spacing.cardPadding)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var requestsPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Requests")
                .font(.hintoH4)

            if incomingRequests.isEmpty && outgoingRequests.isEmpty {
                EmptyFriendsState(
                    title: "No pending requests",
                    message: "Friend requests will show up here."
                )
            } else {
                ForEach(incomingRequests) { request in
                    FriendRequestRow(
                        friendship: request,
                        primaryTitle: "Accept",
                        secondaryTitle: "Decline",
                        primaryAction: { Task { await accept(request) } },
                        secondaryAction: { Task { await decline(request) } }
                    )
                }

                ForEach(outgoingRequests) { request in
                    FriendRequestRow(
                        friendship: request,
                        primaryTitle: "Pending",
                        secondaryTitle: nil,
                        primaryAction: {},
                        secondaryAction: nil
                    )
                }
            }
        }
        .padding(Spacing.cardPadding)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var friendsPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                Text("Your friends")
                    .font(.hintoH4)
                Spacer()
                Text("\(friends.count)")
                    .font(.hintoLabel)
                    .foregroundStyle(.secondary)
            }

            if friends.isEmpty {
                EmptyFriendsState(
                    title: "No friends yet",
                    message: "Invite someone to vote, then add them here."
                )
            } else {
                ForEach(friends) { friendship in
                    FriendRow(friendship: friendship) {
                        Task { await remove(friendship) }
                    }
                }
            }
        }
        .padding(Spacing.cardPadding)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var suggestionsPanel: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("People you may know")
                    .font(.hintoH4)
                Text("A few low-pressure suggestions. Dismiss anything that feels off.")
                    .font(.hintoBodySmall)
                    .foregroundStyle(.secondary)
            }

            if suggestions.isEmpty {
                EmptyFriendsState(
                    title: "No suggestions yet",
                    message: "Suggestions will stay limited and explain why they appear."
                )
            } else {
                ForEach(suggestions) { suggestion in
                    SuggestionRow(
                        suggestion: suggestion,
                        addAction: { Task { await addSuggestion(suggestion) } },
                        dismissAction: { Task { await dismiss(suggestion) } }
                    )
                }
            }
        }
        .padding(Spacing.cardPadding)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var filteredContacts: [InviteContact] {
        let query = contactQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return [] }
        return contacts.filter { contact in
            contact.displayName.lowercased().contains(query)
                || contact.searchTokens.contains { $0.contains(query) }
        }
    }

    private func refresh() async {
        guard let token = auth.accessToken else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            async let friendsResponse = api.getFriends(token: token)
            async let suggestionsResponse = api.getFriendSuggestions(token: token)
            let (loadedFriendsResponse, loadedSuggestionsResponse) = try await (
                friendsResponse,
                suggestionsResponse
            )
            let loadedFriends = loadedFriendsResponse.data
            let loadedSuggestions = loadedSuggestionsResponse.data

            friends = loadedFriends.friends
            incomingRequests = loadedFriends.incomingRequests
            outgoingRequests = loadedFriends.outgoingRequests
            suggestions = loadedSuggestions.suggestions
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func sendUsernameRequest() async {
        guard let token = auth.accessToken else { return }
        let cleaned = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return }

        isSendingRequest = true
        defer { isSendingRequest = false }

        do {
            _ = try await api.createFriendRequest(
                token: token,
                input: CreateFriendRequestRequest(
                    addresseeProfileId: nil,
                    username: cleaned
                )
            )
            username = ""
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func accept(_ request: Friendship) async {
        guard let token = auth.accessToken else { return }
        do {
            _ = try await api.acceptFriendRequest(token: token, friendshipId: request.friendshipId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func decline(_ request: Friendship) async {
        guard let token = auth.accessToken else { return }
        do {
            _ = try await api.declineFriendRequest(token: token, friendshipId: request.friendshipId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func remove(_ friendship: Friendship) async {
        guard let token = auth.accessToken else { return }
        do {
            _ = try await api.removeFriend(token: token, profileId: friendship.otherProfile.profileId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func addSuggestion(_ suggestion: FriendSuggestion) async {
        guard let token = auth.accessToken else { return }
        do {
            _ = try await api.createFriendRequest(
                token: token,
                input: CreateFriendRequestRequest(
                    addresseeProfileId: suggestion.profile.profileId,
                    username: nil
                )
            )
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func dismiss(_ suggestion: FriendSuggestion) async {
        guard let token = auth.accessToken else { return }
        do {
            _ = try await api.dismissFriendSuggestion(token: token, suggestionId: suggestion.suggestionId)
            await refresh()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func createInviteShare(for contact: InviteContact) async {
        guard let token = auth.accessToken else { return }
        do {
            let response = try await api.createShareInvite(
                token: token,
                input: CreateShareInviteRequest(
                    targetType: "friend_invite",
                    targetId: nil,
                    channel: "ios_share",
                    recipientContactHmac: nil
                )
            )
            let text = response.data.share.copyOptions.first?.fullText
                ?? "Add me on HINTO.\n\(response.data.share.shareUrl)"
            selectedShareText = ShareTextItem(text: text)
            contactQuery = contact.displayName
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadContacts() async {
        do {
            let granted = try await requestContactAccessIfNeeded()
            guard granted else {
                errorMessage = "Contact access is off. You can still search by username."
                return
            }

            contacts = try fetchContacts()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func requestContactAccessIfNeeded() async throws -> Bool {
        contactAuthorization = CNContactStore.authorizationStatus(for: .contacts)
        if contactAuthorization == .authorized {
            return true
        }
        if contactAuthorization == .denied || contactAuthorization == .restricted {
            return false
        }

        let granted = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Bool, Error>) in
            contactStore.requestAccess(for: .contacts) { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: granted)
                }
            }
        }
        contactAuthorization = CNContactStore.authorizationStatus(for: .contacts)
        return granted
    }

    private func fetchContacts() throws -> [InviteContact] {
        let keys = [
            CNContactGivenNameKey,
            CNContactFamilyNameKey,
            CNContactOrganizationNameKey,
            CNContactPhoneNumbersKey,
            CNContactEmailAddressesKey
        ] as [CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)
        var results: [InviteContact] = []

        try contactStore.enumerateContacts(with: request) { contact, _ in
            guard let inviteContact = InviteContact(contact: contact) else { return }
            results.append(inviteContact)
        }

        return results.sorted { $0.displayName < $1.displayName }
    }
}

private struct InviteContact: Identifiable {
    let id: String
    let displayName: String
    let detail: String
    let searchTokens: [String]

    init?(contact: CNContact) {
        let name = [contact.givenName, contact.familyName]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        guard !name.isEmpty else { return nil }
        guard !contact.phoneNumbers.isEmpty || !contact.emailAddresses.isEmpty else { return nil }

        let firstPhone = contact.phoneNumbers.first?.value.stringValue
        let firstEmail = contact.emailAddresses.first.map { String($0.value) }
        let detail = firstPhone ?? firstEmail ?? "Contact"

        self.id = contact.identifier
        self.displayName = name
        self.detail = detail
        self.searchTokens = [
            name,
            contact.organizationName,
            firstPhone ?? "",
            firstEmail ?? ""
        ]
        .map { $0.lowercased() }
        .filter { !$0.isEmpty }
    }
}

private struct ShareTextItem: Identifiable {
    let id = UUID()
    let text: String
}

private struct EmptyFriendsState: View {
    let title: String
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(title)
                .font(.hintoLabel)
            Text(message)
                .font(.hintoBodySmall)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }
}

private struct ContactInviteRow: View {
    let contact: InviteContact
    let action: () -> Void

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.title3)
                .foregroundStyle(Color.hintoPink)
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.displayName)
                    .font(.hintoBody)
                Text(contact.detail)
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Invite", action: action)
                .font(.hintoButtonSmall)
                .buttonStyle(.bordered)
                .tint(.hintoPink)
        }
        .padding(Spacing.sm)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }
}

private struct FriendRequestRow: View {
    let friendship: Friendship
    let primaryTitle: String
    let secondaryTitle: String?
    let primaryAction: () -> Void
    let secondaryAction: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            FriendIdentity(profile: friendship.otherProfile, subtitle: requestSubtitle)

            HStack(spacing: Spacing.sm) {
                Button(primaryTitle, action: primaryAction)
                    .buttonStyle(.borderedProminent)
                    .tint(.hintoPink)
                    .disabled(primaryTitle == "Pending")

                if let secondaryTitle, let secondaryAction {
                    Button(secondaryTitle, role: .destructive, action: secondaryAction)
                        .buttonStyle(.bordered)
                }
            }
        }
        .padding(Spacing.md)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var requestSubtitle: String {
        friendship.direction == "outgoing" ? "Request sent" : "Wants to be friends"
    }
}

private struct FriendRow: View {
    let friendship: Friendship
    let removeAction: () -> Void

    var body: some View {
        HStack(spacing: Spacing.sm) {
            FriendIdentity(profile: friendship.otherProfile, subtitle: "Friend")
            Spacer()
            Menu {
                Button("Remove Friend", role: .destructive, action: removeAction)
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
            }
        }
        .padding(Spacing.md)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }
}

private struct SuggestionRow: View {
    let suggestion: FriendSuggestion
    let addAction: () -> Void
    let dismissAction: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            FriendIdentity(profile: suggestion.profile, subtitle: reasonText)

            HStack(spacing: Spacing.sm) {
                Button("Add", action: addAction)
                    .buttonStyle(.borderedProminent)
                    .tint(.hintoPink)
                Button("Dismiss", action: dismissAction)
                    .buttonStyle(.bordered)
            }
        }
        .padding(Spacing.md)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }

    private var reasonText: String {
        if suggestion.mutualCount > 0 {
            return "\(suggestion.mutualCount) mutual friend\(suggestion.mutualCount == 1 ? "" : "s")"
        }
        switch suggestion.reasonCode {
        case "shared_invite": return "Joined from your invite"
        case "contacts": return "In your selected contacts"
        case "shared_voter": return "Voted from a shared link"
        default: return "Suggested for you"
        }
    }
}

private struct FriendIdentity: View {
    let profile: FriendProfileSummary
    let subtitle: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            AvatarView(url: profile.avatarUrl, emoji: nil, size: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(profile.displayName)
                    .font(.hintoBody)
                    .fontWeight(.medium)
                Text("@\(profile.username.isEmpty ? profile.profileId : profile.username) · \(subtitle)")
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

#Preview {
    FriendsView()
        .environment(AuthManager())
        .environment(APIClient())
}
