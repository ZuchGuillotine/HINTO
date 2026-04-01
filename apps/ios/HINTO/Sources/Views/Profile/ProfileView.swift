import SwiftUI
import PhotosUI

struct ProfileView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteConfirmation = false
    @State private var selectedPhoto: PhotosPickerItem?

    // Form fields
    @State private var username = ""
    @State private var displayName = ""
    @State private var bio = ""
    @State private var location = ""
    @State private var website = ""
    @State private var instagram = ""
    @State private var twitter = ""
    @State private var snapchat = ""
    @State private var tiktok = ""
    @State private var privacy: ProfilePrivacy = .private

    private var profile: Profile? { auth.currentUser?.profile }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.lg) {
                    avatarSection
                    profileFields
                    socialLinksSection
                    privacySection
                    accountActions
                }
                .padding(Spacing.md)
            }
            .navigationTitle("Profile")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isEditing ? "Save" : "Edit") {
                        if isEditing {
                            Task { await saveProfile() }
                        } else {
                            isEditing = true
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(isSaving)
                }
            }
            .onAppear { populateFields() }
            .confirmationDialog("Sign Out", isPresented: $showSignOutConfirmation) {
                Button("Sign Out", role: .destructive) { auth.signOut() }
            }
            .confirmationDialog(
                "Delete Account",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete Account", role: .destructive) {
                    auth.signOut()
                }
            } message: {
                Text("This permanently deletes your account and all data. This cannot be undone.")
            }
        }
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: Spacing.xs) {
            if isEditing {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    AvatarView(
                        url: profile?.avatarUrl,
                        emoji: nil,
                        size: 100,
                        showEditOverlay: true
                    )
                }
            } else {
                AvatarView(
                    url: profile?.avatarUrl,
                    emoji: nil,
                    size: 100
                )
            }

            if let email = profile?.email {
                Text(email)
                    .font(.hintoCaption)
                    .foregroundStyle(.secondary)
            }

            if let tier = profile?.subscriptionTier, tier == .premium {
                Label("PRO", systemImage: "crown.fill")
                    .font(.hintoCaption)
                    .foregroundStyle(.hintoPink)
                    .padding(.horizontal, Spacing.xs)
                    .padding(.vertical, 2)
                    .background(Color.hintoPink.opacity(0.15))
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Profile Fields

    private var profileFields: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Profile Settings")
                .font(.hintoH4)

            if isEditing {
                editableField("Username", text: $username)
                editableField("Display Name", text: $displayName)
                editableField("Bio", text: $bio, axis: .vertical)
                editableField("Location", text: $location)
                editableField("Website", text: $website, keyboardType: .URL)
            } else {
                displayField("Username", value: username)
                if !displayName.isEmpty { displayField("Display Name", value: displayName) }
                if !bio.isEmpty { displayField("Bio", value: bio) }
                if !location.isEmpty { displayField("Location", value: location) }
                if !website.isEmpty { displayField("Website", value: website) }
            }
        }
    }

    // MARK: - Social Links

    private var socialLinksSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Social Links")
                .font(.hintoH4)

            if isEditing {
                socialField("Instagram", icon: "camera", text: $instagram)
                socialField("Twitter / X", icon: "at", text: $twitter)
                socialField("Snapchat", icon: "camera.fill", text: $snapchat)
                socialField("TikTok", icon: "music.note", text: $tiktok)
            } else {
                if !instagram.isEmpty { displayField("Instagram", value: "@\(instagram)") }
                if !twitter.isEmpty { displayField("Twitter", value: "@\(twitter)") }
                if !snapchat.isEmpty { displayField("Snapchat", value: "@\(snapchat)") }
                if !tiktok.isEmpty { displayField("TikTok", value: "@\(tiktok)") }
                if instagram.isEmpty && twitter.isEmpty && snapchat.isEmpty && tiktok.isEmpty {
                    Text("No social links added")
                        .font(.hintoBodySmall)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    // MARK: - Privacy

    private var privacySection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Privacy")
                .font(.hintoH4)

            Picker("Profile Visibility", selection: $privacy) {
                ForEach(ProfilePrivacy.allCases) { option in
                    Text(option.displayName).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .disabled(!isEditing)

            Text(privacy.description)
                .font(.hintoCaption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Account Actions

    private var accountActions: some View {
        VStack(spacing: Spacing.sm) {
            HINTOButton(title: "Sign Out", style: .secondary) {
                showSignOutConfirmation = true
            }

            HINTOButton(title: "Delete Account", style: .destructive) {
                showDeleteConfirmation = true
            }
        }
        .padding(.top, Spacing.lg)
    }

    // MARK: - Field Helpers

    @ViewBuilder
    private func editableField(
        _ label: String,
        text: Binding<String>,
        axis: Axis = .horizontal,
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            Text(label)
                .font(.hintoLabel)
                .foregroundStyle(.secondary)

            TextField(label, text: text, axis: axis == .vertical ? .vertical : .horizontal)
                .font(.hintoBody)
                .textFieldStyle(.plain)
                .keyboardType(keyboardType)
                .autocorrectionDisabled(keyboardType == .URL)
                .textInputAutocapitalization(keyboardType == .URL ? .never : .sentences)
                .padding(Spacing.sm)
                .background(Color(.tertiarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
                .lineLimit(axis == .vertical ? 3...6 : 1...1)
        }
    }

    @ViewBuilder
    private func socialField(_ label: String, icon: String, text: Binding<String>) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundStyle(.secondary)

            TextField(label, text: text)
                .font(.hintoBody)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(Spacing.sm)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
    }

    @ViewBuilder
    private func displayField(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.hintoBody)
            Spacer()
            Text(value)
                .font(.hintoBody)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, Spacing.xs)
    }

    // MARK: - Data

    private func populateFields() {
        guard let profile else { return }
        username = profile.username
        displayName = profile.displayName
        bio = profile.bio ?? ""
        privacy = profile.privacy
    }

    private func saveProfile() async {
        isSaving = true
        defer {
            isSaving = false
            isEditing = false
        }

        guard let token = auth.accessToken else { return }

        let update = UpdateProfileRequest(
            displayName: displayName.isEmpty ? nil : displayName,
            bio: bio.isEmpty ? nil : bio,
            privacy: privacy
        )

        if let response = try? await api.updateMe(token: token, update: update) {
            auth.currentUser = response.data
        }
    }
}

#Preview {
    ProfileView()
        .environment(AuthManager())
        .environment(APIClient())
}
