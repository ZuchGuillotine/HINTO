import SwiftUI

struct FriendsFeedView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var items: [FeedItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

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
                    VStack(alignment: .leading, spacing: Spacing.sm) {
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
                        }

                        HStack(spacing: Spacing.sm) {
                            AvatarView(
                                url: nil,
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
                    }
                    .padding(Spacing.md)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                }
            } header: {
                Text("\(items.count) shared situationship\(items.count == 1 ? "" : "s")")
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

                Text("Accepted friends' shared lists will appear here when the backend has friendship data.")
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
}

#Preview {
    FriendsFeedView()
        .environment(AuthManager())
        .environment(APIClient())
}
