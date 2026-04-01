import Foundation

enum ProfilePrivacy: String, Codable, CaseIterable, Identifiable {
    case `public`
    case `private`
    case mutualsOnly = "mutuals_only"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .public: "Public"
        case .private: "Private"
        case .mutualsOnly: "Mutuals Only"
        }
    }

    var description: String {
        switch self {
        case .public: "Anyone can see your profile"
        case .private: "Only you can see your profile"
        case .mutualsOnly: "Only mutual connections can see your profile"
        }
    }
}

enum SubscriptionTier: String, Codable {
    case free
    case premium
    case unknown
}

struct SocialLinks: Codable, Equatable {
    var instagram: String?
    var twitter: String?
    var snapchat: String?
    var tiktok: String?

    var isEmpty: Bool {
        [instagram, twitter, snapchat, tiktok].allSatisfy { $0?.isEmpty != false }
    }
}

struct Profile: Codable, Identifiable, Equatable {
    let profileId: String
    var username: String
    var displayName: String
    var email: String?
    var bio: String?
    var avatarUrl: String?
    var privacy: ProfilePrivacy
    var subscriptionTier: SubscriptionTier
    let createdAt: String
    var updatedAt: String

    var id: String { profileId }
}

struct AuthIdentity: Codable {
    let authUserId: String
    let profileId: String
    let primaryProvider: String?
    let linkedProviders: [String]
    let status: String
}

struct MeCapabilities: Codable {
    let canEditProfile: Bool
    let canCreateSituationship: Bool
    let canUseAiCoach: Bool
}

struct MeAggregate: Codable {
    let profile: Profile
    let auth: AuthIdentity
    let capabilities: MeCapabilities
}

struct UpdateProfileRequest: Codable {
    var displayName: String?
    var bio: String?
    var avatarUrl: String?
    var privacy: ProfilePrivacy?
}
