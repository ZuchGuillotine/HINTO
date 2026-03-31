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
    private let profileKey = "hinto_profile_cache"

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
        self.isLoading = false
    }

    func setSession(token: String, user: MeAggregate) {
        self.accessToken = token
        self.currentUser = user
        self.isAuthenticated = true
        self.authError = nil
        UserDefaults.standard.set(token, forKey: tokenKey)
    }

    func signOut() {
        accessToken = nil
        currentUser = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: profileKey)
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

    // MARK: - Social Auth Placeholder

    func signInWithProvider(_ provider: AuthProvider) async throws {
        // In production, each provider redirects to backend OAuth flow
        // Backend exchanges tokens and returns Supabase session
        switch provider {
        case .apple:
            try await signInWithApple()
        case .facebook, .snapchat, .tiktok, .email:
            // Placeholder: these would open ASWebAuthenticationSession
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

    var errorDescription: String? {
        switch self {
        case .invalidCredential: "Invalid sign-in credential"
        case .providerNotImplemented(let p): "\(p) sign-in coming soon"
        case .cancelled: "Sign-in was cancelled"
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
