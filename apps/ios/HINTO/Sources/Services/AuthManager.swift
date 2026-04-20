import Foundation
import AuthenticationServices
import Observation

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

        // In production, send identityToken to backend for Supabase auth exchange
        // For now, store as session token placeholder
        let mockUser = MeAggregate(
            profile: Profile(
                profileId: credential.user,
                username: credential.fullName?.givenName?.lowercased() ?? "user",
                displayName: [credential.fullName?.givenName, credential.fullName?.familyName]
                    .compactMap { $0 }.joined(separator: " "),
                email: credential.email,
                bio: nil,
                avatarUrl: nil,
                privacy: .private,
                subscriptionTier: .free,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                updatedAt: ISO8601DateFormatter().string(from: Date())
            ),
            auth: AuthIdentity(
                authUserId: credential.user,
                profileId: credential.user,
                primaryProvider: "apple",
                linkedProviders: ["apple"],
                status: "active"
            ),
            capabilities: MeCapabilities(
                canEditProfile: true,
                canCreateSituationship: true,
                canUseAiCoach: true
            )
        )

        setSession(token: tokenString, user: mockUser)
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

    func sendEmailOtp(email: String) async throws {
        let client = APIClient()
        let _ = try await client.sendEmailOtp(email: normalizeEmail(email))
    }

    func verifyEmailOtp(email: String, code: String) async throws {
        let client = APIClient()
        let response = try await client.verifyEmailOtp(
            email: normalizeEmail(email),
            code: code.trimmingCharacters(in: .whitespacesAndNewlines)
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

    // MARK: - Social Auth Placeholder

    func signInWithProvider(_ provider: AuthProvider) async throws {
        switch provider {
        case .apple:
            try await signInWithApple()
        case .email:
            // Email handled via EmailSignInView directly
            break
        case .facebook, .snapchat, .tiktok:
            throw AuthError.providerNotImplemented(provider.rawValue)
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
    case cancelled
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .invalidCredential: "Invalid sign-in credential"
        case .providerNotImplemented(let p): "\(p) sign-in coming soon"
        case .cancelled: "Sign-in was cancelled"
        case .sessionExpired: "Your session has expired. Please sign in again."
        }
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
