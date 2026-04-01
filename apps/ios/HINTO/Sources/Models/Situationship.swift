import Foundation

enum SituationshipCategory: String, CaseIterable, Identifiable {
    case friend = "Friend"
    case crush = "Crush"
    case ex = "Ex"
    case family = "Family"
    case work = "Work"
    case other = "Other"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .friend: "👯"
        case .crush: "💕"
        case .ex: "💔"
        case .family: "👨‍👩‍👧"
        case .work: "💼"
        case .other: "✨"
        }
    }
}

enum SituationshipStatus: String, Codable {
    case active
    case archived
}

struct Situationship: Codable, Identifiable, Equatable, Hashable {
    let situationshipId: String
    let ownerProfileId: String
    var name: String
    var emoji: String?
    var category: String?
    var description: String?
    var rank: Int
    var status: SituationshipStatus
    let createdAt: String
    var updatedAt: String

    var id: String { situationshipId }

    var displayEmoji: String {
        emoji ?? SituationshipCategory(rawValue: category ?? "")?.emoji ?? "💖"
    }

    var categoryEnum: SituationshipCategory? {
        guard let category else { return nil }
        return SituationshipCategory(rawValue: category)
    }
}

enum ViewerMode: String, Codable {
    case owner
    case authorizedViewer = "authorized_viewer"
    case publicSessionViewer = "public_session_viewer"
}

struct ViewerContext: Codable {
    let mode: ViewerMode
    let viewerProfileId: String?
}

struct SituationshipCapabilities: Codable {
    let canEdit: Bool
    let canReorder: Bool
    let canVote: Bool
}

struct SituationshipListAggregate: Codable {
    let ownerProfile: OwnerProfileSummary
    let viewerContext: ViewerContext
    let items: [Situationship]
    let ordering: Ordering
    let capabilities: SituationshipCapabilities
}

struct OwnerProfileSummary: Codable {
    let profileId: String
    let username: String
    let displayName: String
}

struct Ordering: Codable {
    let orderedSituationshipIds: [String]
}

struct CreateSituationshipRequest: Codable {
    let name: String
    var emoji: String?
    var category: String?
    var description: String?
}

struct UpdateSituationshipRequest: Codable {
    var name: String?
    var emoji: String?
    var category: String?
    var description: String?
    var status: SituationshipStatus?
}

struct ReorderRequest: Codable {
    let orderedSituationshipIds: [String]
}
