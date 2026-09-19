import SwiftUI
import PhotosUI

enum SituationshipDetailMode {
    case create
    case edit(Situationship)
}

struct SituationshipDetailView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    let mode: SituationshipDetailMode
    var onSave: ((Situationship) -> Void)?
    /// Called with the deleted situationship id so the presenting list can drop the row.
    var onDelete: ((String) -> Void)?

    @State private var name = ""
    @State private var emoji = "💖"
    @State private var category: SituationshipCategory? = .crush
    @State private var description = ""
    @State private var isSaving = false
    @State private var isDeleting = false
    @State private var showDeleteConfirmation = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var errorTitle = "Something went wrong"
    @State private var errorMessage: String?
    @State private var showError = false

    @FocusState private var nameFieldFocused: Bool

    private var isEditing: Bool {
        if case .edit = mode { return true }
        return false
    }

    private var existingSituationship: Situationship? {
        if case .edit(let s) = mode { return s }
        return nil
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.lg) {
                    avatarSection
                    detailsSection
                    emojiSection

                    if isEditing {
                        deleteSection
                    }
                }
                .padding(Spacing.md)
            }
            .navigationTitle(isEditing ? "Edit" : "New Situationship")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving || isDeleting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        Task { await save() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving || isDeleting)
                    .fontWeight(.semibold)
                }
            }
            .onAppear { populateFromExisting() }
            .confirmationDialog(
                "Delete Situationship",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    Task { await deleteSituationship() }
                }
            } message: {
                Text("This can't be undone. Are you sure?")
            }
            .alert(errorTitle, isPresented: $showError) {
                Button("OK") {}
            } message: {
                Text(errorMessage ?? "Please try again.")
            }
        }
    }

    // MARK: - Avatar Section

    private var avatarSection: some View {
        VStack(spacing: Spacing.sm) {
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                AvatarView(
                    url: nil,
                    emoji: emoji,
                    size: 120,
                    showEditOverlay: true
                )
            }

            Text("Tap to add a photo")
                .font(.hintoCaption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Details")
                .font(.hintoH4)

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                TextField("Name", text: $name)
                    .font(.hintoBody)
                    .textFieldStyle(.plain)
                    .padding(Spacing.sm)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
                    .focused($nameFieldFocused)

                if name.count > 40 {
                    Text("\(50 - name.count) characters remaining")
                        .font(.hintoCaption)
                        .foregroundStyle(name.count > 50 ? Color.hintoError : Color.secondary)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Category")
                    .font(.hintoLabel)
                    .foregroundStyle(.secondary)

                CategoryPicker(selected: $category)
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                TextField("Notes (optional)", text: $description, axis: .vertical)
                    .font(.hintoBody)
                    .lineLimit(3...6)
                    .textFieldStyle(.plain)
                    .padding(Spacing.sm)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.base))
            }
        }
    }

    // MARK: - Emoji Section

    private var emojiSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Choose an Emoji")
                .font(.hintoH4)

            EmojiPicker(selectedEmoji: $emoji)
        }
    }

    // MARK: - Delete Section

    private var deleteSection: some View {
        HINTOButton(title: "Delete Situationship", style: .destructive, icon: "trash", isLoading: isDeleting) {
            showDeleteConfirmation = true
        }
        .padding(.top, Spacing.lg)
    }

    // MARK: - Actions

    private func populateFromExisting() {
        guard let existing = existingSituationship else {
            nameFieldFocused = true
            return
        }
        name = existing.name
        emoji = existing.displayEmoji
        category = existing.categoryEnum
        description = existing.description ?? ""
    }

    private func save() async {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }

        guard let token = auth.accessToken else {
            presentError(title: "Could not save", AuthError.sessionExpired.errorDescription)
            return
        }

        isSaving = true
        defer { isSaving = false }

        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            if let existing = existingSituationship {
                let request = UpdateSituationshipRequest(
                    name: trimmedName,
                    emoji: emoji,
                    category: category?.rawValue,
                    description: trimmedDescription.isEmpty ? nil : trimmedDescription
                )
                let response = try await api.updateSituationship(
                    token: token, id: existing.id, input: request
                )
                onSave?(response.data.situationship)
            } else {
                let request = CreateSituationshipRequest(
                    name: trimmedName,
                    emoji: emoji,
                    category: category?.rawValue,
                    description: trimmedDescription.isEmpty ? nil : trimmedDescription
                )
                let response = try await api.createSituationship(
                    token: token, input: request
                )
                onSave?(response.data.situationship)
            }
            dismiss()
        } catch {
            #if DEBUG
            // Preview Mode (offline, fabricated session) fakes the write locally.
            if auth.accessToken == "dev-token" {
                let now = ISO8601DateFormatter().string(from: Date())
                let mock = Situationship(
                    situationshipId: existingSituationship?.id ?? UUID().uuidString,
                    ownerProfileId: "dev",
                    name: trimmedName,
                    emoji: emoji,
                    category: category?.rawValue,
                    description: trimmedDescription.isEmpty ? nil : trimmedDescription,
                    rank: existingSituationship?.rank ?? 99,
                    status: .active,
                    createdAt: existingSituationship?.createdAt ?? now,
                    updatedAt: now
                )
                onSave?(mock)
                dismiss()
                return
            }
            #endif
            // Keep the sheet open so nothing the user typed is lost.
            presentError(title: isEditing ? "Could not save changes" : "Could not add situationship", error.localizedDescription)
        }
    }

    private func deleteSituationship() async {
        guard let existing = existingSituationship else { return }
        guard let token = auth.accessToken else {
            presentError(title: "Could not delete", AuthError.sessionExpired.errorDescription)
            return
        }

        isDeleting = true
        defer { isDeleting = false }

        do {
            _ = try await api.deleteSituationship(token: token, id: existing.id)
            onDelete?(existing.id)
            dismiss()
        } catch {
            #if DEBUG
            if auth.accessToken == "dev-token" {
                onDelete?(existing.id)
                dismiss()
                return
            }
            #endif
            presentError(title: "Could not delete", error.localizedDescription)
        }
    }

    private func presentError(title: String, _ message: String?) {
        errorTitle = title
        errorMessage = message
        showError = true
    }
}

#Preview("Create") {
    SituationshipDetailView(mode: .create)
        .environment(AuthManager())
        .environment(APIClient())
}
