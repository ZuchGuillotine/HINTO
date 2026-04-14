import Foundation

enum VotingSessionStatus: String, Codable {
    case active
    case expired
    case closed
}

struct VotingSession: Codable, Identifiable {
    let votingSessionId: String
    let ownerProfileId: String
    let inviteCode: String
    let status: VotingSessionStatus
    let expiresAt: String
    let createdAt: String

    var id: String { votingSessionId }

    var isExpired: Bool {
        guard let date = ISO8601DateFormatter().date(from: expiresAt) else { return true }
        return date < Date()
    }

    var timeRemaining: String {
        guard let date = ISO8601DateFormatter().date(from: expiresAt) else { return "Expired" }
        let interval = date.timeIntervalSince(Date())
        guard interval > 0 else { return "Expired" }

        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m left"
        }
        return "\(minutes)m left"
    }
}

struct VoteSubmission: Codable {
    let votingSessionId: String
    let voterIdentity: String
    var voterName: String?
    let bestSituationshipId: String
    let worstSituationshipId: String
    var comment: String?
}

struct VoteResult: Codable, Identifiable {
    let situationshipId: String
    let name: String
    let emoji: String?
    let bestVotes: Int
    let worstVotes: Int
    let totalVotes: Int

    var id: String { situationshipId }

    var score: Int { bestVotes - worstVotes }

    var bestPercentage: Double {
        guard totalVotes > 0 else { return 0 }
        return Double(bestVotes) / Double(totalVotes) * 100
    }
}

struct VoteResultsAggregate: Codable {
    let session: VotingSession
    let totalVotes: Int
    let totalVoters: Int
    let results: [VoteResult]
    let comments: [VoteComment]
}

struct VoteComment: Codable, Identifiable {
    let comment: String
    let createdAt: String
    let voteType: String
    let situationshipId: String
    let voterLabel: String?

    var id: String {
        "\(situationshipId)-\(createdAt)-\(voteType)"
    }
}

struct CreateVotingSessionRequest: Encodable {
    var title: String? = nil
    var description: String? = nil
    var anonymityMode: String = "anonymous"
    var expiresInHours: Int = 48
}

struct CreateVotingSessionData: Decodable {
    let session: VotingSession
    let itemsCount: Int
    let publicPath: String
}

struct VotingSessionMutationData: Decodable {
    let session: VotingSession
}

struct PublicVotingSessionAggregate: Decodable {
    let session: VotingSession
    let ownerProfile: OwnerProfileSummary
    let viewerContext: PublicVotingViewerContext
    let items: [Situationship]
    let capabilities: PublicVotingCapabilities
    let audience: PublicVotingAudience
}

struct PublicVotingViewerContext: Decodable {
    let mode: String
}

struct PublicVotingCapabilities: Decodable {
    let canVote: Bool
    let canComment: Bool
}

struct PublicVotingAudience: Decodable {
    let mode: String
}

struct SubmitVoteRequest: Encodable {
    let voterIdentity: String
    let voterName: String?
    let bestSituationshipId: String
    let worstSituationshipId: String
    let comment: String?
}

struct SubmitVoteData: Decodable {
    let votingSessionId: String
    let accepted: Bool
    let votesRecorded: Int
    let selections: VoteSelections
}

struct VoteSelections: Decodable {
    let bestSituationshipId: String
    let worstSituationshipId: String
}
