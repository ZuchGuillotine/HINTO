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

    @State private var name = ""
    @State private var emoji = "💖"
    @State private var category: SituationshipCategory? = .crush
    @State private var description = ""
    @State private var isSaving = false
    @State private var showDeleteConfirmation = false
    @State private var selectedPhoto: PhotosPickerItem?

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
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") {
                        Task { await save() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
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
                        .foregroundStyle(name.count > 50 ? .hintoError : .secondary)
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
        HINTOButton(title: "Delete Situationship", style: .destructive, icon: "trash") {
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
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isSaving = true
        defer { isSaving = false }

        guard let token = auth.accessToken else { return }

        do {
            if let existing = existingSituationship {
                let request = UpdateSituationshipRequest(
                    name: name.trimmingCharacters(in: .whitespaces),
                    emoji: emoji,
                    category: category?.rawValue,
                    description: description.isEmpty ? nil : description
                )
                let response = try await api.updateSituationship(
                    token: token, id: existing.id, input: request
                )
                onSave?(response.data.situationship)
            } else {
                let request = CreateSituationshipRequest(
                    name: name.trimmingCharacters(in: .whitespaces),
                    emoji: emoji,
                    category: category?.rawValue,
                    description: description.isEmpty ? nil : description
                )
                let response = try await api.createSituationship(
                    token: token, input: request
                )
                onSave?(response.data.situationship)
            }
            dismiss()
        } catch {
            // In dev mode, create a mock
            if auth.accessToken == "dev-token" {
                let mock = Situationship(
                    situationshipId: UUID().uuidString,
                    ownerProfileId: "dev",
                    name: name,
                    emoji: emoji,
                    category: category?.rawValue,
                    description: description.isEmpty ? nil : description,
                    rank: 99,
                    status: .active,
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    updatedAt: ISO8601DateFormatter().string(from: Date())
                )
                onSave?(mock)
                dismiss()
            }
        }
    }

    private func deleteSituationship() async {
        guard let existing = existingSituationship,
              let token = auth.accessToken else { return }
        _ = try? await api.deleteSituationship(token: token, id: existing.id)
        dismiss()
    }
}

#Preview("Create") {
    SituationshipDetailView(mode: .create)
        .environment(AuthManager())
        .environment(APIClient())
}
