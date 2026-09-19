import AuthenticationServices
import CryptoKit
import Foundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class AuthManager: NSObject {
    var currentUser: MeAggregate?
    var isAuthenticated = false
    var isLoading = true
    var authError: String?

    /// Current API bearer token, read from the Keychain-backed `SessionStore`.
    /// Always reflects the latest refreshed token, even when `APIClient` rotated it.
    var accessToken: String? {
        sessionStore.accessToken
    }

    /// True once signed in until the user has confirmed their age (`profile.age == nil`).
    var needsAgeConfirmation: Bool {
        guard let currentUser else { return false }
        return currentUser.profile.age == nil
    }

    private let sessionStore: SessionStore
    private let api: APIClient
    private let profileKey = "hinto_profile_cache"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    @ObservationIgnored private var notificationObservers: [NSObjectProtocol] = []
    @ObservationIgnored private var appleCoordinator: AppleSignInCoordinator?
    @ObservationIgnored private var appleController: ASAuthorizationController?

    init(sessionStore: SessionStore = .shared, api: APIClient = APIClient()) {
        self.sessionStore = sessionStore
        self.api = api
        super.init()
        sessionStore.migrateLegacyUserDefaultsIfNeeded()
        observeSessionNotifications()
        Task { await restoreSession() }
    }

    // MARK: - Session

    /// Validates any stored session against `GET /v1/me`. Rejected credentials clear the
    /// session; a network failure keeps the cached profile so the app still opens offline.
    func restoreSession() async {
        defer { isLoading = false }

        guard let token = sessionStore.accessToken else {
            clearSessionState()
            return
        }

        let cachedUser = loadCachedProfile()

        do {
            let response = try await api.getMe(token: token)
            applyUser(response.data)
            isAuthenticated = true
        } catch let error as APIError where error.isAuthenticationFailure {
            sessionStore.clear()
            clearSessionState()
        } catch {
            // Server unreachable or returned a non-auth error: keep the cached session.
            currentUser = cachedUser
            isAuthenticated = true
        }
    }

    func setSession(_ session: AuthSession) {
        setSession(token: session.accessToken, refreshToken: session.refreshToken, user: session.me)
    }

    func setSession(token: String, refreshToken: String? = nil, user: MeAggregate) {
        sessionStore.save(accessToken: token, refreshToken: refreshToken)
        applyUser(user)
        isAuthenticated = true
        authError = nil
    }

    func signOut() {
        sessionStore.clear()
        clearSessionState()
    }

    /// Calls `DELETE /v1/me` (server deletes the auth user and cascades) and then signs out locally.
    func deleteAccount() async throws {
        guard let token = accessToken else {
            throw AuthError.sessionExpired
        }
        _ = try await api.deleteMe(token: token)
        signOut()
    }

    /// Records the user's self-reported age via `PATCH /v1/me`.
    func confirmAge(_ age: Int) async throws {
        guard age >= Profile.minimumAge else {
            throw AuthError.underage
        }
        guard let token = accessToken else {
            throw AuthError.sessionExpired
        }
        let response = try await api.updateMe(token: token, update: UpdateProfileRequest(age: age))
        applyUser(response.data)
    }

    private func applyUser(_ user: MeAggregate) {
        currentUser = user
        if let encoded = try? encoder.encode(user) {
            UserDefaults.standard.set(encoded, forKey: profileKey)
        }
    }

    private func loadCachedProfile() -> MeAggregate? {
        guard let data = UserDefaults.standard.data(forKey: profileKey) else { return nil }
        return try? decoder.decode(MeAggregate.self, from: data)
    }

    private func clearSessionState() {
        currentUser = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: profileKey)
    }

    private func observeSessionNotifications() {
        let center = NotificationCenter.default

        notificationObservers.append(
            center.addObserver(forName: .hintoSessionInvalidated, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in
                    self?.handleSessionInvalidated()
                }
            }
        )

        notificationObservers.append(
            center.addObserver(forName: .hintoSessionRefreshed, object: nil, queue: .main) { [weak self] notification in
                let refreshedUser = notification.userInfo?["me"] as? MeAggregate
                Task { @MainActor in
                    self?.handleSessionRefreshed(refreshedUser)
                }
            }
        )
    }

    private func handleSessionInvalidated() {
        guard isAuthenticated || currentUser != nil else { return }
        signOut()
        authError = AuthError.sessionExpired.errorDescription
    }

    private func handleSessionRefreshed(_ user: MeAggregate?) {
        if let user {
            applyUser(user)
        }
        isAuthenticated = true
    }

    // MARK: - Sign in with Apple

    func signInWithApple() async throws {
        let rawNonce = Self.randomNonce()

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256Hex(rawNonce)

        let authorization = try await performAppleSignIn(request: request)

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8),
              !identityToken.isEmpty else {
            throw AuthError.invalidCredential
        }

        // Apple only provides the name on the first authorization for this app.
        var fullName: AppleFullName?
        if let components = credential.fullName,
           components.givenName != nil || components.familyName != nil {
            fullName = AppleFullName(givenName: components.givenName, familyName: components.familyName)
        }

        let response = try await api.signInWithApple(
            input: AppleSignInRequest(
                identityToken: identityToken,
                nonce: rawNonce,
                fullName: fullName
            )
        )
        setSession(response.data)
    }

    private func performAppleSignIn(request: ASAuthorizationAppleIDRequest) async throws -> ASAuthorization {
        let coordinator = AppleSignInCoordinator(anchor: Self.presentationAnchor())
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = coordinator
        controller.presentationContextProvider = coordinator

        // Keep both alive for the duration of the system sheet.
        appleCoordinator = coordinator
        appleController = controller
        defer {
            appleCoordinator = nil
            appleController = nil
        }

        return try await withCheckedThrowingContinuation { continuation in
            coordinator.continuation = continuation
            controller.performRequests()
        }
    }

    private static func presentationAnchor() -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        return windows.first(where: { $0.isKeyWindow }) ?? windows.first ?? ASPresentationAnchor()
    }

    /// Cryptographically random nonce (SystemRandomNumberGenerator is backed by the platform CSPRNG).
    private static func randomNonce(length: Int = 32) -> String {
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in charset.randomElement(using: &generator)! })
    }

    private static func sha256Hex(_ input: String) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Email Auth

    func sendEmailOtp(email: String) async throws {
        _ = try await api.sendEmailOtp(email: email)
    }

    func verifyEmailOtp(email: String, code: String) async throws {
        let response = try await api.verifyEmailOtp(email: email, code: code)
        setSession(response.data)
    }

    // MARK: - Token Refresh

    /// Forces a refresh of the stored session. `APIClient` already refreshes transparently on 401,
    /// so this is only needed by callers that want to pre-empt expiry.
    func refreshSessionIfNeeded() async throws {
        guard sessionStore.refreshToken != nil else {
            signOut()
            throw AuthError.sessionExpired
        }
        do {
            _ = try await SessionRefresher.shared.refresh(store: sessionStore, baseURL: api.baseURL)
        } catch let error as APIError where error.isAuthenticationFailure {
            signOut()
            throw AuthError.sessionExpired
        }
    }

    // MARK: - Provider Dispatch

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

    // MARK: - Development-only sign-in (never compiled into release)

    #if DEBUG
    func signInForLocalDevelopment() async throws {
        let request = DevelopmentSessionRequest(
            profileId: "dev-user-001",
            username: "local_dev",
            displayName: "Local Dev",
            email: "dev@hinto.app",
            privacy: .private
        )
        let response = try await api.createDevelopmentSession(input: request)
        setSession(token: response.data.accessToken, user: response.data.me)
    }

    /// Offline preview mode with a fabricated profile. Uses the `dev-token` sentinel that
    /// debug-only mock fallbacks in the list/detail views key off.
    func devSignIn() {
        let now = ISO8601DateFormatter().string(from: Date())
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
                age: 25,
                ageVerified: true,
                createdAt: now,
                updatedAt: now
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
    #endif
}

// MARK: - Auth Types

enum AuthProvider: String, CaseIterable, Identifiable {
    case apple
    case facebook
    case snapchat
    case tiktok
    case email

    var id: String { rawValue }

    /// Providers with a working end-to-end flow. Only these render on the onboarding screen.
    static let onboardingProviders: [AuthProvider] = [.apple, .email]

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

    var backgroundColor: Color {
        switch self {
        case .apple: Color.socialApple
        case .facebook: Color.socialFacebook
        case .snapchat: Color.socialSnapchat
        case .tiktok: Color.socialTikTok
        case .email: Color.hintoBlue
        }
    }

    var foregroundColor: Color {
        switch self {
        case .snapchat: Color.black
        default: Color.white
        }
    }
}

enum AuthError: LocalizedError {
    case invalidCredential
    case providerNotImplemented(String)
    case cancelled
    case sessionExpired
    case underage

    var errorDescription: String? {
        switch self {
        case .invalidCredential: "Invalid sign-in credential"
        case .providerNotImplemented(let provider): "\(provider.capitalized) sign-in is not available"
        case .cancelled: "Sign-in was cancelled"
        case .sessionExpired: "Your session has expired. Please sign in again."
        case .underage: "You must be at least \(Profile.minimumAge) to use HINTO."
        }
    }
}

// MARK: - Apple Sign In Coordinator

/// Delegate + presentation-context provider for `ASAuthorizationController`.
/// Not actor-isolated: the anchor is captured up front on the main actor so the
/// delegate callbacks never need to touch UIKit state.
private final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private let anchor: ASPresentationAnchor
    var continuation: CheckedContinuation<ASAuthorization, any Error>?

    init(anchor: ASPresentationAnchor) {
        self.anchor = anchor
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        continuation?.resume(returning: authorization)
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: any Error) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            continuation?.resume(throwing: AuthError.cancelled)
        } else {
            continuation?.resume(throwing: error)
        }
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
}
