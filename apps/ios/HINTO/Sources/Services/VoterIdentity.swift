import Foundation

/// Stable per-device identity for public (unauthenticated) voting.
/// The API uses it to enforce one vote per voter per session.
enum VoterIdentity {
    private static let key = "hinto_voter_identity"

    static var current: String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: key), !existing.isEmpty {
            return existing
        }
        let created = UUID().uuidString.lowercased()
        defaults.set(created, forKey: key)
        return created
    }
}
