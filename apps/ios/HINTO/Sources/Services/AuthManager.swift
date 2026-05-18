import Foundation
import AuthenticationServices
import Observation
import UIKit

@Observable
final class AuthManager: NSObject {
    var currentUser: MeAggregate?
    var isAuthenticated = false
    var isLoading = true
    var authError: String?

    private(set) var accessToken: String?

    private let tokenKey = "hinto_access_token"
    private let refreshTokenKey = "hinto_refresh_token"
    private let profileKey = "hinto_profile_cache"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()
    private var providerWebAuthSession: ASWebAuthenticationSession?

    override init() {
        super.init()
        restoreSession()
    }

    // MARK: - Session

    private func restoreSession() {
        if let token = UserDefaults.standard.string(forKey: tokenKey) {
            self.accessToken = token
            self.isAuthenticated = true
        }
        if let data = UserDefaults.standard.data(forKey: profileKey),
           let user = try? decoder.decode(MeAggregate.self, from: data) {
            self.currentUser = user
        }
        self.isLoading = false
    }

    func setSession(token: String, refreshToken: String? = nil, user: MeAggregate) {
        self.accessToken = token
        self.currentUser = user
        self.isAuthenticated = true
        self.authError = nil
        UserDefaults.standard.set(token, forKey: tokenKey)
        if let refreshToken {
            UserDefaults.standard.set(refreshToken, forKey: refreshTokenKey)
        }
        if let encoded = try? encoder.encode(user) {
            UserDefaults.standard.set(encoded, forKey: profileKey)
        }
    }

    func signOut() {
        accessToken = nil
        currentUser = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: refreshTokenKey)
        UserDefaults.standard.removeObject(forKey: profileKey)
    }

    func signInForLocalDevelopment() async throws {
        let request = DevelopmentSessionRequest(
            profileId: "dev-user-001",
            username: "local_dev",
            displayName: "Local Dev",
            email: "dev@hinto.app",
            privacy: .private
        )
        let client = APIClient()
        let response = try await client.createDevelopmentSession(input: request)
        setSession(token: response.data.accessToken, user: response.data.me)
    }

    // MARK: - Sign in with Apple

    func signInWithApple() async throws {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        let result = try await performAppleSignIn(request: request)
        guard let credential = result.credential as? ASAuthorizationAppleIDCredential,
              let identityToken = credential.identityToken,
              let tokenString = String(data: identityToken, encoding: .utf8) else {
            throw AuthError.invalidCredential
        }

        let displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        let response = try await APIClient().signInWithNativeApple(
            identityToken: tokenString,
            email: credential.email,
            displayName: displayName.isEmpty ? nil : displayName
        )
        setSession(
            token: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.me
        )
    }

    @MainActor
    private func performAppleSignIn(request: ASAuthorizationAppleIDRequest) async throws -> ASAuthorization {
        try await withCheckedThrowingContinuation { continuation in
            let delegate = AppleSignInDelegate(continuation: continuation)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = delegate

            // Retain delegate for callback
            objc_setAssociatedObject(controller, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)
            controller.performRequests()
        }
    }

    // MARK: - Email Auth

    private func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    func sendEmailOtp(
        email: String,
        intent: AuthIntent,
        username: String? = nil,
        displayName: String? = nil
    ) async throws -> EmailOtpResponse {
        let client = APIClient()
        let response = try await client.sendEmailOtp(
            email: normalizeEmail(email),
            intent: intent,
            username: username,
            displayName: displayName
        )
        return response.data
    }

    func verifyEmailOtp(
        email: String,
        code: String,
        intent: AuthIntent,
        username: String? = nil,
        displayName: String? = nil
    ) async throws {
        let client = APIClient()
        let response = try await client.verifyEmailOtp(
            email: normalizeEmail(email),
            code: code.trimmingCharacters(in: .whitespacesAndNewlines),
            intent: intent,
            username: username,
            displayName: displayName
        )
        setSession(
            token: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.me
        )
    }

    func signUpWithEmailPassword(
        email: String,
        password: String,
        username: String,
        displayName: String
    ) async throws {
        let client = APIClient()
        let response = try await client.signUpWithEmailPassword(
            email: normalizeEmail(email),
            password: password,
            username: username.trimmingCharacters(in: .whitespacesAndNewlines),
            displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        setSession(
            token: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.me
        )
    }

    func signInWithEmailPassword(email: String, password: String) async throws {
        let client = APIClient()
        let response = try await client.signInWithEmailPassword(
            email: normalizeEmail(email),
            password: password
        )
        setSession(
            token: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.me
        )
    }

    // MARK: - Token Refresh

    func refreshSessionIfNeeded() async throws {
        guard let refreshToken = UserDefaults.standard.string(forKey: refreshTokenKey) else {
            signOut()
            throw AuthError.sessionExpired
        }
        let client = APIClient()
        let response = try await client.refreshSession(refreshToken: refreshToken)
        setSession(
            token: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            user: response.data.me
        )
    }

    // MARK: - Social Auth

    func signInWithProvider(_ provider: AuthProvider) async throws {
        switch provider {
        case .apple:
            try await signInWithApple()
        case .email:
            // Email handled via EmailSignInView directly
            break
        case .snapchat, .tiktok:
            try await signInWithCustomProvider(provider)
        case .facebook:
            throw AuthError.providerNotImplemented(provider.rawValue)
        }
    }

    private func signInWithCustomProvider(_ provider: AuthProvider) async throws {
        let clientRedirectUri = "hinto://auth/provider-callback"
        let client = APIClient()
        let startResponse = try await client.startProviderAuth(
            provider: provider,
            clientRedirectUri: clientRedirectUri
        )

        guard let authorizationUrl = URL(string: startResponse.data.authorizationUrl) else {
            throw AuthError.invalidCredential
        }

        let callbackUrl = try await performProviderSignIn(
            authorizationUrl: authorizationUrl,
            callbackScheme: "hinto"
        )
        let params = callbackUrl.fragmentParameters.merging(callbackUrl.queryParameters) {
            fragmentValue, _ in fragmentValue
        }

        if let error = params["error"] {
            throw AuthError.providerFailed(params["errorDescription"] ?? error)
        }

        guard let accessToken = params["accessToken"] else {
            throw AuthError.invalidCredential
        }

        let refreshToken = params["refreshToken"]
        let meResponse = try await client.getMe(token: accessToken)
        setSession(token: accessToken, refreshToken: refreshToken, user: meResponse.data)
    }

    @MainActor
    private func performProviderSignIn(
        authorizationUrl: URL,
        callbackScheme: String
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authorizationUrl,
                callbackURLScheme: callbackScheme
            ) { callbackUrl, error in
                if let error {
                    if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                        continuation.resume(throwing: AuthError.cancelled)
                    } else {
                        continuation.resume(throwing: error)
                    }
                    return
                }

                guard let callbackUrl else {
                    continuation.resume(throwing: AuthError.invalidCredential)
                    return
                }

                continuation.resume(returning: callbackUrl)
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            providerWebAuthSession = session
            session.start()
        }
    }

    // MARK: - Dev Bypass

    func devSignIn() {
        let mockUser = MeAggregate(
            profile: Profile(
                profileId: "dev-user-001",
                username: "testuser",
                displayName: "Test User",
                email: "test@hinto.app",
                bio: "Just testing things out",
                avatarUrl: nil,
                privacy: .private,
                subscriptionTier: .free,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            ),
            auth: AuthIdentity(
                authUserId: "dev-auth-001",
                profileId: "dev-user-001",
                primaryProvider: "dev",
                linkedProviders: ["dev"],
                status: "active"
            ),
            capabilities: MeCapabilities(
                canEditProfile: true,
                canCreateSituationship: true,
                canUseAiCoach: true
            )
        )
        setSession(token: "dev-token", user: mockUser)
    }
}

// MARK: - Auth Types

enum AuthIntent: String, Identifiable {
    case signUp
    case signIn

    var id: String { rawValue }

    var apiValue: String {
        switch self {
        case .signUp: "sign_up"
        case .signIn: "sign_in"
        }
    }

    var heading: String {
        switch self {
        case .signUp: "Create your account"
        case .signIn: "Welcome back"
        }
    }

    var subheading: String {
        switch self {
        case .signUp: "Choose how you'd like to set up your account"
        case .signIn: "Choose how you'd like to sign in"
        }
    }

    var emailHeading: String {
        switch self {
        case .signUp: "Sign up with Email"
        case .signIn: "Sign in with Email"
        }
    }

    var emailSubheading: String {
        switch self {
        case .signUp: "Choose an email and password to set up your account"
        case .signIn: "Use your email and password to continue"
        }
    }
}

enum AuthProvider: String, CaseIterable, Identifiable {
    case apple
    case facebook
    case snapchat
    case tiktok
    case email

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .apple: "Sign in with Apple"
        case .facebook: "Continue with Facebook"
        case .snapchat: "Continue with Snapchat"
        case .tiktok: "Continue with TikTok"
        case .email: "Continue with Email"
        }
    }

    var iconName: String {
        switch self {
        case .apple: "apple.logo"
        case .facebook: "f.square.fill"
        case .snapchat: "camera.fill"
        case .tiktok: "music.note"
        case .email: "envelope.fill"
        }
    }

    var backgroundColor: SwiftUI.Color {
        switch self {
        case .apple: .socialApple
        case .facebook: .socialFacebook
        case .snapchat: .socialSnapchat
        case .tiktok: .socialTikTok
        case .email: .hintoBlue
        }
    }

    var foregroundColor: SwiftUI.Color {
        switch self {
        case .snapchat: .black
        default: .white
        }
    }
}

import SwiftUI

enum AuthError: LocalizedError {
    case invalidCredential
    case providerNotImplemented(String)
    case providerFailed(String)
    case cancelled
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .invalidCredential: "Invalid sign-in credential"
        case .providerNotImplemented(let p): "\(p) sign-in coming soon"
        case .providerFailed(let message): message
        case .cancelled: "Sign-in was cancelled"
        case .sessionExpired: "Your session has expired. Please sign in again."
        }
    }
}

private extension URL {
    var queryParameters: [String: String] {
        URLComponents(url: self, resolvingAgainstBaseURL: false)?
            .queryItems?
            .reduce(into: [String: String]()) { result, item in
                result[item.name] = item.value
            } ?? [:]
    }

    var fragmentParameters: [String: String] {
        guard let fragment else { return [:] }
        return URLComponents(string: "hinto://callback?\(fragment)")?
            .queryItems?
            .reduce(into: [String: String]()) { result, item in
                result[item.name] = item.value
            } ?? [:]
    }
}

extension AuthManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        return scene?.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}

// MARK: - Apple Sign In Delegate

private class AppleSignInDelegate: NSObject, ASAuthorizationControllerDelegate {
    let continuation: CheckedContinuation<ASAuthorization, any Error>

    init(continuation: CheckedContinuation<ASAuthorization, any Error>) {
        self.continuation = continuation
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        continuation.resume(returning: authorization)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: any Error) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            continuation.resume(throwing: AuthError.cancelled)
        } else {
            continuation.resume(throwing: error)
        }
    }
}
