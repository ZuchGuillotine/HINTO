import Foundation

extension Notification.Name {
    /// Posted by `APIClient` after a successful token refresh. `userInfo["me"]` holds the new `MeAggregate`.
    static let hintoSessionRefreshed = Notification.Name("app.hinto.session.refreshed")
    /// Posted by `APIClient` when the refresh token is rejected; the stored session has already been cleared.
    static let hintoSessionInvalidated = Notification.Name("app.hinto.session.invalidated")
}

/// Source of truth for the API session tokens, backed by the Keychain.
/// Shared by `AuthManager` (sign-in / sign-out) and `APIClient` (401 refresh).
final class SessionStore: Sendable {
    static let shared = SessionStore()

    private let keychain: KeychainStore
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"

    init(keychain: KeychainStore = KeychainStore(service: "app.hinto.session")) {
        self.keychain = keychain
    }

    var accessToken: String? {
        keychain.string(forKey: accessTokenKey)
    }

    var refreshToken: String? {
        keychain.string(forKey: refreshTokenKey)
    }

    var hasSession: Bool {
        accessToken != nil
    }

    func save(accessToken: String, refreshToken: String?) {
        keychain.set(accessToken, forKey: accessTokenKey)
        if let refreshToken, !refreshToken.isEmpty {
            keychain.set(refreshToken, forKey: refreshTokenKey)
        }
    }

    func clear() {
        keychain.remove(forKey: accessTokenKey)
        keychain.remove(forKey: refreshTokenKey)
    }

    /// Earlier builds kept tokens in UserDefaults. Move them into the Keychain once and
    /// scrub the old keys so they never linger in the plist-backed store.
    func migrateLegacyUserDefaultsIfNeeded() {
        let defaults = UserDefaults.standard
        let legacyAccessKey = "hinto_access_token"
        let legacyRefreshKey = "hinto_refresh_token"

        if accessToken == nil, let legacyToken = defaults.string(forKey: legacyAccessKey), !legacyToken.isEmpty {
            save(accessToken: legacyToken, refreshToken: defaults.string(forKey: legacyRefreshKey))
        }
        defaults.removeObject(forKey: legacyAccessKey)
        defaults.removeObject(forKey: legacyRefreshKey)
    }
}
