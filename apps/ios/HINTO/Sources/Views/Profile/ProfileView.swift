import SwiftUI
import PhotosUI

/// Profile editor. Expects to live inside a `NavigationStack` supplied by the caller
/// (the Profile tab wraps it; Settings pushes it) so stacks never nest.
struct ProfileView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var isDeleting = false
    @State private var showSignOutConfirmation = false
    @State private var showDeleteConfirmation = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var errorTitle = "Something went wrong"
    @State private var errorMessage: String?
    @State private var showError = false

    // Form fields
    @State private var username = ""
    @State private var displayName = ""
    @State private var bio = ""
    @State private var privacy: ProfilePrivacy = .private

    private var profile: Profile? { auth.currentUser?.profile }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                avatarSection
                profileFields
                linkedProvidersSection
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
                .disabled(isSaving || isDeleting)
            }
        }
        .onAppear { populateFields() }
        .onChange(of: profile) {
            if !isEditing { populateFields() }
        }
        .confirmationDialog("Sign Out", isPresented: $showSignOutConfirmation) {
            Button("Sign Out", role: .destructive) { auth.signOut() }
        }
        .confirmationDialog(
            "Delete Account",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete Account", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("This permanently deletes your account, your list, votes, and coach conversations. This cannot be undone.")
        }
        .alert(errorTitle, isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "Please try again.")
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
                    .foregroundStyle(Color.hintoPink)
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
            } else {
                displayField("Username", value: username)
                if !displayName.isEmpty { displayField("Display Name", value: displayName) }
                if !bio.isEmpty { displayField("Bio", value: bio) }
            }

            if let age = profile?.age {
                displayField("Age", value: "\(age)")
            }
        }
    }

    // MARK: - Linked Providers

    private var linkedProvidersSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Connected Sign-In")
                .font(.hintoH4)

            if let providers = auth.currentUser?.auth.linkedProviders, !providers.isEmpty {
                ForEach(providers, id: \.self) { provider in
                    Label(provider.capitalized, systemImage: "link")
                        .font(.hintoBody)
                }
            } else {
                Text("No linked sign-in providers.")
                    .font(.hintoBodySmall)
                    .foregroundStyle(.tertiary)
            }

            if let primaryProvider = auth.currentUser?.auth.primaryProvider {
                displayField("Primary", value: primaryProvider.capitalized)
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
            .disabled(isDeleting)

            HINTOButton(title: "Delete Account", style: .destructive, isLoading: isDeleting) {
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
        guard let token = auth.accessToken else {
            presentError(title: "Could not save profile", AuthError.sessionExpired.errorDescription)
            return
        }

        isSaving = true
        defer { isSaving = false }

        let trimmedUsername = username.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDisplayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)
        let hadBio = !(profile?.bio ?? "").isEmpty

        let update = UpdateProfileRequest(
            username: trimmedUsername.isEmpty ? nil : trimmedUsername,
            displayName: trimmedDisplayName.isEmpty ? nil : trimmedDisplayName,
            bio: trimmedBio.isEmpty ? nil : trimmedBio,
            clearBio: trimmedBio.isEmpty && hadBio,
            privacy: privacy
        )

        do {
            let response = try await api.updateMe(token: token, update: update)
            auth.currentUser = response.data
            isEditing = false
        } catch {
            // Stay in edit mode so nothing the user typed is lost.
            presentError(title: "Could not save profile", error.localizedDescription)
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        defer { isDeleting = false }

        do {
            try await auth.deleteAccount()
            // AuthManager signs out on success; RootView returns to onboarding.
        } catch {
            presentError(title: "Could not delete account", error.localizedDescription)
        }
    }

    private func presentError(title: String, _ message: String?) {
        errorTitle = title
        errorMessage = message
        showError = true
    }
}

#Preview {
    NavigationStack {
        ProfileView()
            .environment(AuthManager())
            .environment(APIClient())
    }
}
