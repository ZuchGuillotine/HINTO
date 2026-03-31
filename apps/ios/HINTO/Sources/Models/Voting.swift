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
    let votingSessionId: String
    let totalVoters: Int
    let results: [VoteResult]
}
