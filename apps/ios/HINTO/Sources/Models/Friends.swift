import Foundation

struct FriendProfileSummary: Codable, Identifiable {
    let profileId: String
    let username: String
    let displayName: String
    let avatarUrl: String?

    var id: String { profileId }
}

struct Friendship: Codable, Identifiable {
    let friendshipId: String
    let status: String
    let direction: String
    let otherProfile: FriendProfileSummary
    let requestedAt: String
    let respondedAt: String?
    let createdAt: String
    let updatedAt: String?

    var id: String { friendshipId }
}

struct FriendsAggregate: Codable {
    let viewerProfileId: String
    let friends: [Friendship]
    let incomingRequests: [Friendship]
    let outgoingRequests: [Friendship]
}

struct FriendRequestsData: Codable {
    let viewerProfileId: String
    let incomingRequests: [Friendship]
    let outgoingRequests: [Friendship]
}

struct CreateFriendRequestRequest: Encodable {
    let addresseeProfileId: String?
    let username: String?
}

struct FriendRequestMutationData: Decodable {
    let friendship: FriendshipStorageEcho?
    let acceptedIncomingRequest: Bool?
}

struct FriendshipStorageEcho: Decodable {
    let id: String?
    let requester_id: String?
    let addressee_id: String?
    let status: String?
}

struct DeleteFriendData: Decodable {
    let friendProfileId: String
    let removed: Bool
}

struct FriendSuggestion: Codable, Identifiable {
    let suggestionId: String
    let source: String
    let reasonCode: String
    let score: Int
    let mutualCount: Int
    let profile: FriendProfileSummary
    let createdAt: String
    let expiresAt: String

    var id: String { suggestionId }
}

struct FriendSuggestionsData: Codable {
    let viewerProfileId: String
    let suggestions: [FriendSuggestion]
}

struct DismissFriendSuggestionData: Decodable {
    let suggestionId: String
    let dismissed: Bool
}
