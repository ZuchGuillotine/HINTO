import Foundation

/// Session payload returned by every route that establishes a session
/// (`POST /v1/auth/email/verify`, `POST /v1/auth/refresh`, `POST /v1/auth/apple`).
struct AuthSession: Decodable {
    let accessToken: String
    let refreshToken: String
    /// Unix epoch seconds when the access token expires.
    let expiresAt: Int?
    let me: MeAggregate
}

// MARK: - Email OTP

struct EmailOtpRequest: Encodable {
    let email: String
}

struct EmailOtpResponse: Decodable {
    let sent: Bool
    let email: String
}

struct EmailVerifyRequest: Encodable {
    let email: String
    let token: String
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

// MARK: - Sign in with Apple

struct AppleFullName: Encodable {
    let givenName: String?
    let familyName: String?
}

/// Body for `POST /v1/auth/apple`. `nonce` is the raw nonce whose SHA-256
/// hex digest was passed to `ASAuthorizationAppleIDRequest.nonce`.
struct AppleSignInRequest: Encodable {
    let identityToken: String
    let nonce: String?
    /// Apple only returns the name on first sign-in; forwarded so the profile can be seeded.
    let fullName: AppleFullName?
}

// MARK: - Development-only session (never compiled into release)

#if DEBUG
struct DevelopmentSessionRequest: Encodable {
    var profileId: String
    var username: String
    var displayName: String
    var email: String?
    var privacy: ProfilePrivacy
}

struct DevelopmentSessionData: Decodable {
    let accessToken: String
    let me: MeAggregate
    let development: Bool
}
#endif
