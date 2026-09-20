import SwiftUI

/// Shown after sign-in until the profile carries an age. HINTO is 16+.
struct AgeConfirmationView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(APIClient.self) private var api

    @State private var selectedAge = 18
    @State private var isSaving = false
    @State private var errorMessage: String?

    private let ageRange = 16...99

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()

            VStack(spacing: Spacing.sm) {
                Text("🎂")
                    .font(.system(size: 64))

                Text("How old are you?")
                    .font(.hintoH1)
                    .multilineTextAlignment(.center)

                Text("HINTO is for people 16 and up. Your age stays private and helps us keep the community safe.")
                    .font(.hintoBody)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }

            Picker("Age", selection: $selectedAge) {
                ForEach(ageRange, id: \.self) { age in
                    Text("\(age)").tag(age)
                }
            }
            .pickerStyle(.wheel)
            .frame(maxHeight: 180)

            Spacer()

            VStack(spacing: Spacing.sm) {
                HINTOButton(
                    title: "Continue",
                    style: .primary,
                    icon: "checkmark",
                    isLoading: isSaving
                ) {
                    Task { await confirmAge() }
                }

                Button("Sign out") {
                    auth.signOut()
                }
                .font(.hintoCaption)
                .foregroundStyle(.secondary)
                .disabled(isSaving)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xl)
        }
        .alert("Age", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .task {
            await auth.refreshCurrentUser(using: api)
        }
    }

    private func confirmAge() async {
        guard let token = auth.accessToken else { return }
        isSaving = true
        defer { isSaving = false }

        do {
            let response = try await api.updateMe(
                token: token,
                update: UpdateProfileRequest(age: selectedAge)
            )
            auth.applyAgeConfirmation(me: response.data)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    AgeConfirmationView()
        .environment(AuthManager())
        .environment(APIClient())
}
