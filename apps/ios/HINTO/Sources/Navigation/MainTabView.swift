import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Tab = .home

    enum Tab: String, CaseIterable {
        case home
        case feed
        case chat
        case profile
        case settings

        var title: String {
            switch self {
            case .home: "My List"
            case .feed: "Rank"
            case .chat: "HNNT"
            case .profile: "Profile"
            case .settings: "Settings"
            }
        }

        var icon: String {
            switch self {
            case .home: "heart.text.clipboard"
            case .feed: "person.2"
            case .chat: "bubble.left.and.text.bubble.right"
            case .profile: "person.crop.circle"
            case .settings: "gearshape"
            }
        }

        var selectedIcon: String {
            switch self {
            case .home: "heart.text.clipboard.fill"
            case .feed: "person.2.fill"
            case .chat: "bubble.left.and.text.bubble.right.fill"
            case .profile: "person.crop.circle.fill"
            case .settings: "gearshape.fill"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.allCases, id: \.self) { tab in
                tabContent(for: tab)
                    .tabItem {
                        Label(
                            tab.title,
                            systemImage: selectedTab == tab ? tab.selectedIcon : tab.icon
                        )
                    }
                    .tag(tab)
            }
        }
        .sensoryFeedback(.selection, trigger: selectedTab)
    }

    @ViewBuilder
    private func tabContent(for tab: Tab) -> some View {
        switch tab {
        case .home:
            SituationshipListView()
        case .feed:
            FriendsFeedView()
        case .chat:
            ChatView()
        case .profile:
            ProfileView()
        case .settings:
            SettingsView()
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthManager())
        .environment(APIClient())
}
