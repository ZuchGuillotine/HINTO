import SwiftUI

struct EmailSignInView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var code = ""
    @State private var step: Step = .email
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showError = false

    @FocusState private var focusedField: Field?

    private enum Step {
        case email, code
    }

    private enum Field {
        case email, code
    }

    var body: some View {
        VStack(spacing: Spacing.lg) {
            header

            switch step {
            case .email:
                emailStep
            case .code:
                codeStep
            }

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
            Image(systemName: step == .email ? "envelope.fill" : "lock.fill")
                .font(.system(size: 40))
                .foregroundStyle(.hintoPink)

            Text(step == .email ? "Sign in with Email" : "Enter your code")
                .font(.hintoH2)

            Text(step == .email
                 ? "We'll send a verification code to your email"
                 : "Check \(email) for a 6-digit code")
                .font(.hintoBodySmall)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, Spacing.sm)
    }

    // MARK: - Email Step

    private var emailStep: some View {
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

            HINTOButton(
                title: "Send Code",
                style: .primary,
                icon: "paperplane.fill",
                isLoading: isLoading
            ) {
                Task { await sendOtp() }
            }
            .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .onAppear { focusedField = .email }
    }

    // MARK: - Code Step

    private var codeStep: some View {
        VStack(spacing: Spacing.md) {
            TextField("6-digit code", text: $code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 28, weight: .semibold, design: .monospaced))
                .focused($focusedField, equals: .code)
                .padding(Spacing.md)
                .background(Color.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))

            HINTOButton(
                title: "Verify",
                style: .primary,
                icon: "checkmark.circle.fill",
                isLoading: isLoading
            ) {
                Task { await verify() }
            }
            .disabled(code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

            Button("Resend code") {
                Task { await sendOtp() }
            }
            .font(.hintoCaption)
            .foregroundStyle(.hintoPink)
            .disabled(isLoading)

            Button("Use a different email") {
                withAnimation {
                    step = .email
                    code = ""
                }
            }
            .font(.hintoCaption)
            .foregroundStyle(.secondary)
            .disabled(isLoading)
        }
        .onAppear { focusedField = .code }
    }

    // MARK: - Actions

    private func sendOtp() async {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            try await auth.sendEmailOtp(email: trimmed)
            withAnimation {
                step = .code
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    private func verify() async {
        let trimmedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCode.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            try await auth.verifyEmailOtp(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                code: trimmedCode
            )
            // Auth state updates automatically via AuthManager;
            // RootView will navigate away from onboarding.
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
