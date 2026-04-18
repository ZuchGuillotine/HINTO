import XCTest
@testable import HINTO

/// Asserts that the SwiftUI client models stay in sync with the JSON envelopes
/// produced by `services/api`. Catches contract drift at build time.
final class ContractDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testMeAggregateDecodesFromGetMeResponse() throws {
        let payload = """
        {
          "data": {
            "profile": {
              "profileId": "11111111-1111-1111-1111-111111111111",
              "username": "alex",
              "displayName": "Alex",
              "email": "alex@example.com",
              "bio": null,
              "avatarUrl": null,
              "privacy": "public",
              "subscriptionTier": "free",
              "createdAt": "2026-01-01T00:00:00Z",
              "updatedAt": "2026-01-02T00:00:00Z"
            },
            "auth": {
              "authUserId": "11111111-1111-1111-1111-111111111111",
              "profileId": "11111111-1111-1111-1111-111111111111",
              "primaryProvider": "email",
              "linkedProviders": ["email"],
              "status": "active"
            },
            "capabilities": {
              "canEditProfile": true,
              "canCreateSituationship": true,
              "canUseAiCoach": true
            }
          }
        }
        """.data(using: .utf8)!

        let response = try decoder.decode(APIResponse<MeAggregate>.self, from: payload)

        XCTAssertEqual(response.data.profile.username, "alex")
        XCTAssertEqual(response.data.profile.privacy, .public)
        XCTAssertEqual(response.data.auth.linkedProviders, ["email"])
        XCTAssertTrue(response.data.capabilities.canUseAiCoach)
    }

    func testVotingSessionStatusDecodesAllVariants() throws {
        let payload = """
        {
          "votingSessionId": "22222222-2222-2222-2222-222222222222",
          "ownerProfileId": "11111111-1111-1111-1111-111111111111",
          "inviteCode": "ABCD1234",
          "title": "Rate them",
          "description": null,
          "visibility": "session_link",
          "anonymityMode": "anonymous",
          "status": "active",
          "expiresAt": "2030-01-01T00:00:00Z",
          "createdAt": "2026-01-01T00:00:00Z"
        }
        """.data(using: .utf8)!

        let session = try decoder.decode(VotingSession.self, from: payload)
        XCTAssertEqual(session.status, .active)
        XCTAssertEqual(session.inviteCode, "ABCD1234")
        XCTAssertFalse(session.isExpired)
    }

    func testPublicVotingSessionAggregateDecodes() throws {
        let payload = """
        {
          "data": {
            "session": {
              "votingSessionId": "22222222-2222-2222-2222-222222222222",
              "ownerProfileId": "11111111-1111-1111-1111-111111111111",
              "inviteCode": "ABCD1234",
              "title": "Rate them",
              "description": null,
              "visibility": "session_link",
              "anonymityMode": "anonymous",
              "status": "active",
              "expiresAt": "2030-01-01T00:00:00Z",
              "createdAt": "2026-01-01T00:00:00Z"
            },
            "ownerProfile": {
              "profileId": "11111111-1111-1111-1111-111111111111",
              "username": "alex",
              "displayName": "Alex"
            },
            "viewerContext": { "mode": "public_session_viewer" },
            "items": [],
            "capabilities": { "canVote": true, "canComment": true },
            "audience": { "mode": "session_link" }
          }
        }
        """.data(using: .utf8)!

        let response = try decoder.decode(APIResponse<PublicVotingSessionAggregate>.self, from: payload)
        XCTAssertEqual(response.data.session.inviteCode, "ABCD1234")
        XCTAssertTrue(response.data.capabilities.canVote)
        XCTAssertEqual(response.data.items.count, 0)
    }

    func testAPIErrorEnvelopeDecodes() throws {
        let payload = """
        {
          "error": {
            "code": "duplicate_vote",
            "message": "This voter identity has already submitted a vote for the session",
            "requestId": "req-123"
          }
        }
        """.data(using: .utf8)!

        let envelope = try decoder.decode(APIErrorEnvelope.self, from: payload)
        XCTAssertEqual(envelope.error.code, "duplicate_vote")
        XCTAssertEqual(envelope.error.requestId, "req-123")
    }

    func testSubmitVoteRequestEncodesExpectedKeys() throws {
        let request = SubmitVoteRequest(
            voterIdentity: "device-001",
            voterName: "Taylor",
            bestSituationshipId: "11111111-1111-1111-1111-111111111111",
            worstSituationshipId: "22222222-2222-2222-2222-222222222222",
            comment: "go for it"
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let data = try encoder.encode(request)
        let json = String(data: data, encoding: .utf8) ?? ""

        XCTAssertTrue(json.contains("\"voterIdentity\":\"device-001\""))
        XCTAssertTrue(json.contains("\"bestSituationshipId\""))
        XCTAssertTrue(json.contains("\"worstSituationshipId\""))
    }
}
