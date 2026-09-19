import SwiftUI

/// Shown after sign-in until the profile carries a confirmed age (`profile.age == nil`).
/// Sends `PATCH /v1/me { age }`; the API rejects anything under `Profile.minimumAge`.
struct AgeConfirmationView: View {
    @Environment(AuthManager.self) private var auth

    @State private var selectedAge = 18
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showError = false

    private let ages = Array(Profile.minimumAge...99)

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            VStack(spacing: Spacing.sm) {
                Image(systemName: "birthday.cake.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.hintoPink)

                Text("How old are you?")
                    .font(.hintoH2)

                Text("HINTO is for people \(Profile.minimumAge) and older. Your age is used only to keep the community safe and is never shown to other users.")
                    .font(.hintoBody)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.lg)
            }

            Picker("Age", selection: $selectedAge) {
                ForEach(ages, id: \.self) { age in
                    Text("\(age)").tag(age)
                }
            }
            .pickerStyle(.wheel)
            .frame(height: 160)
            .disabled(isSaving)

            Spacer()

            HINTOButton(
                title: "Confirm",
                style: .primary,
                icon: "checkmark",
                isLoading: isSaving
            ) {
                Task { await confirm() }
            }
            .padding(.horizontal, Spacing.lg)

            Button("Sign out") {
                auth.signOut()
            }
            .font(.hintoCaption)
            .foregroundStyle(.secondary)
            .disabled(isSaving)
        }
        .padding(.bottom, Spacing.xl)
        .alert("Could not save your age", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "Something went wrong")
        }
    }

    private func confirm() async {
        isSaving = true
        defer { isSaving = false }

        do {
            try await auth.confirmAge(selectedAge)
            // RootView observes `auth.needsAgeConfirmation` and moves on to the main tabs.
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    AgeConfirmationView()
        .environment(AuthManager())
}
