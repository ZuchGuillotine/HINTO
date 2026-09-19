import Foundation

// Report and block DTOs (packages/contracts/src/moderation.ts).
//
// Routes:
// - POST   /v1/reports
// - GET    /v1/me/blocks
// - POST   /v1/me/blocks
// - DELETE /v1/me/blocks/:profileId

enum ReportContentType: String, Codable {
    case profile
    case situationship
    case vote
    case message
}

enum ReportStatus: String, Codable {
    case pending
    case reviewed
    case resolved
    case dismissed
}

struct CreateReportRequest: Encodable {
    let contentType: ReportContentType
    /// UUID of the reported object (profile, situationship, vote, or message id).
    let contentId: String
    /// Profile that owns the reported content, when known.
    var reportedProfileId: String? = nil
    /// Short machine-friendly reason such as "harassment", "spam", "underage", "other".
    let reason: String
    var description: String? = nil
}

struct Report: Codable, Identifiable {
    let reportId: String
    let contentType: ReportContentType
    let contentId: String
    let reason: String
    let status: ReportStatus
    let createdAt: String

    var id: String { reportId }
}

struct CreateReportData: Decodable {
    let report: Report
}

struct Block: Codable, Identifiable {
    let blockedProfileId: String
    let reason: String?
    let createdAt: String

    var id: String { blockedProfileId }
}

struct ListBlocksData: Decodable {
    let blocks: [Block]
}

struct CreateBlockRequest: Encodable {
    let blockedProfileId: String
    var reason: String? = nil
}

struct CreateBlockData: Decodable {
    let block: Block
}

struct DeleteBlockData: Decodable {
    let blockedProfileId: String
    let removed: Bool
}
