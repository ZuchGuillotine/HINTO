import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    @AppStorage("hapticFeedback") private var hapticFeedback = true

    var body: some View {
        NavigationStack {
            List {
                // Account
                Section("Account") {
                    if let profile = auth.currentUser?.profile {
                        HStack {
                            AvatarView(url: profile.avatarUrl, emoji: nil, size: 44)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.displayName)
                                    .font(.hintoBody)
                                    .fontWeight(.medium)
                                Text("@\(profile.username)")
                                    .font(.hintoCaption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if profile.subscriptionTier == .premium {
                                Label("PRO", systemImage: "crown.fill")
                                    .font(.hintoCaption)
                                    .foregroundStyle(Color.hintoPink)
                            }
                        }
                    }

                    NavigationLink {
                        ProfileView()
                    } label: {
                        Label("Edit Profile", systemImage: "person.crop.circle")
                    }
                }

                // Preferences
                Section("Preferences") {
                    Toggle(isOn: $notificationsEnabled) {
                        Label("Notifications", systemImage: "bell.fill")
                    }
                    .tint(.hintoPink)

                    Toggle(isOn: $hapticFeedback) {
                        Label("Haptic Feedback", systemImage: "waveform")
                    }
                    .tint(.hintoPink)
                }

                // Voting
                Section("Voting") {
                    NavigationLink {
                        VoteResultsView(situationships: [])
                    } label: {
                        Label("Past Results", systemImage: "chart.bar.fill")
                    }
                }

                // Support
                Section("Support") {
                    Link(destination: URL(string: "https://hinto.app/privacy")!) {
                        Label("Privacy Policy", systemImage: "hand.raised.fill")
                    }

                    Link(destination: URL(string: "https://hinto.app/terms")!) {
                        Label("Terms of Service", systemImage: "doc.text.fill")
                    }

                    Label("Version 1.0.0", systemImage: "info.circle")
                        .foregroundStyle(.secondary)
                }

                // Danger zone
                Section {
                    Button(role: .destructive) {
                        auth.signOut()
                    } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    SettingsView()
        .environment(AuthManager())
}
