import SwiftUI

struct EmailSignInView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss

    let intent: AuthIntent

    @State private var email = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false

    @FocusState private var focusedField: Field?

    init(intent: AuthIntent = .signIn) {
        self.intent = intent
    }

    private enum Field {
        case email, password, username, displayName
    }

    var body: some View {
        VStack(spacing: Spacing.lg) {
            header
            emailPasswordForm

            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.xl)
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "Something went wrong")
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: "envelope.fill")
                .font(.system(size: 40))
                .foregroundStyle(Color.hintoPink)

            Text(intent.emailHeading)
                .font(.hintoH2)

            Text(intent.emailSubheading)
                .font(.hintoBodySmall)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, Spacing.sm)
    }

    // MARK: - Password Form

    private var emailPasswordForm: some View {
        VStack(spacing: Spacing.md) {
            TextField("Email address", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($focusedField, equals: .email)
                .padding(Spacing.md)
                .background(Color.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

            SecureField("Password", text: $password)
                .textContentType(intent == .signUp ? .newPassword : .password)
                .focused($focusedField, equals: .password)
                .padding(Spacing.md)
                .background(Color.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

            if intent == .signUp {
                TextField("Username", text: $username)
                    .textContentType(.username)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding(Spacing.md)
                    .background(Color.secondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

                TextField("Display name", text: $displayName)
                    .textContentType(.name)
                    .padding(Spacing.md)
                    .background(Color.secondaryBackground)
                    .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
            }

            HINTOButton(
                title: intent == .signUp ? "Create account" : "Sign in",
                style: .primary,
                icon: intent == .signUp ? "sparkles" : "person.fill",
                isLoading: isLoading
            ) {
                Task { await submitPasswordAuth() }
            }
            .disabled(!canSubmitPasswordForm)
        }
        .onAppear { focusedField = .email }
    }

    private var canSubmitPasswordForm: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            password.count >= 8 &&
            (intent == .signIn ||
             (!username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
              !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty))
    }

    // MARK: - Actions

    private func submitPasswordAuth() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty, password.count >= 8 else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            switch intent {
            case .signUp:
                try await auth.signUpWithEmailPassword(
                    email: trimmed,
                    password: password,
                    username: username.trimmingCharacters(in: .whitespacesAndNewlines),
                    displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            case .signIn:
                try await auth.signInWithEmailPassword(email: trimmed, password: password)
            }
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    NavigationStack {
        EmailSignInView()
            .environment(AuthManager())
    }
}
