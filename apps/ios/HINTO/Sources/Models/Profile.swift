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
    /// Minimum self-reported age accepted by the API (`UpdateMeRequestDto.age`).
    static let minimumAge = 16

    let profileId: String
    var username: String
    var displayName: String
    var email: String?
    var bio: String?
    var avatarUrl: String?
    var privacy: ProfilePrivacy
    var subscriptionTier: SubscriptionTier
    /// Self-reported age; nil until confirmed during onboarding.
    var age: Int?
    var ageVerified: Bool
    let createdAt: String
    var updatedAt: String

    var id: String { profileId }

    enum CodingKeys: String, CodingKey {
        case profileId
        case username
        case displayName
        case email
        case bio
        case avatarUrl
        case privacy
        case subscriptionTier
        case age
        case ageVerified
        case createdAt
        case updatedAt
    }
}

extension Profile {
    /// Tolerant decoding: `age`/`ageVerified`/`bio` may be absent from older
    /// API builds or cached blobs, and an unknown tier must not break sign-in.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        profileId = try container.decode(String.self, forKey: .profileId)
        username = try container.decode(String.self, forKey: .username)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? ""
        email = try container.decodeIfPresent(String.self, forKey: .email)
        bio = try container.decodeIfPresent(String.self, forKey: .bio)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        privacy = try container.decodeIfPresent(ProfilePrivacy.self, forKey: .privacy) ?? .private
        subscriptionTier = (try? container.decodeIfPresent(SubscriptionTier.self, forKey: .subscriptionTier)) ?? .unknown
        age = try container.decodeIfPresent(Int.self, forKey: .age)
        ageVerified = try container.decodeIfPresent(Bool.self, forKey: .ageVerified) ?? false
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    }
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

/// Body for `PATCH /v1/me`. Optional fields are omitted when nil, except `bio`,
/// which is sent as JSON `null` when `clearBio` is set so the server clears it.
struct UpdateProfileRequest: Encodable {
    var username: String?
    var displayName: String?
    var bio: String?
    var clearBio: Bool = false
    var avatarUrl: String?
    var privacy: ProfilePrivacy?
    /// Minimum accepted value is `Profile.minimumAge`.
    var age: Int?

    private enum CodingKeys: String, CodingKey {
        case username
        case displayName
        case bio
        case avatarUrl
        case privacy
        case age
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(username, forKey: .username)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        if let bio {
            try container.encode(bio, forKey: .bio)
        } else if clearBio {
            try container.encodeNil(forKey: .bio)
        }
        try container.encodeIfPresent(avatarUrl, forKey: .avatarUrl)
        try container.encodeIfPresent(privacy, forKey: .privacy)
        try container.encodeIfPresent(age, forKey: .age)
    }
}

struct DeleteMeData: Decodable {
    let deleted: Bool
    let profileId: String
}
