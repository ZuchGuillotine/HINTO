import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        NavigationStack {
            List {
                // Account
                Section("Account") {
                    if let profile = auth.currentUser?.profile {
                        HStack {
                            AvatarView(url: profile.avatarUrl, emoji: nil, size: 44)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.displayName.isEmpty ? profile.username : profile.displayName)
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

                // Support
                Section("Support") {
                    Link(destination: URL(string: "https://hinto.app/privacy")!) {
                        Label("Privacy Policy", systemImage: "hand.raised.fill")
                    }

                    Link(destination: URL(string: "https://hinto.app/terms")!) {
                        Label("Terms of Service", systemImage: "doc.text.fill")
                    }

                    Link(destination: URL(string: "mailto:support@hinto.app")!) {
                        Label("Report a problem", systemImage: "exclamationmark.bubble")
                    }

                    Label(Self.versionString, systemImage: "info.circle")
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

    private static var versionString: String {
        let info = Bundle.main.infoDictionary ?? [:]
        let version = info["CFBundleShortVersionString"] as? String ?? "0"
        let build = info["CFBundleVersion"] as? String ?? "0"
        return "Version \(version) (\(build))"
    }
}

#Preview {
    SettingsView()
        .environment(AuthManager())
        .environment(APIClient())
}
