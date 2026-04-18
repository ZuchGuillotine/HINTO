import Foundation
import Observation

@Observable
final class APIClient {
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    var baseURL: URL {
        URL(string: Configuration.apiBaseURL)!
    }

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        _ method: HTTPMethod,
        path: String,
        body: (any Encodable)? = nil,
        token: String? = nil
    ) async throws -> T {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(normalizedPath)
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            if let errorEnvelope = try? decoder.decode(APIErrorEnvelope.self, from: data) {
                throw APIError.server(
                    code: errorEnvelope.error.code,
                    message: errorEnvelope.error.message,
                    statusCode: httpResponse.statusCode
                )
            }
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Profile

    func getMe(token: String) async throws -> APIResponse<MeAggregate> {
        try await request(.get, path: "/v1/me", token: token)
    }

    func updateMe(token: String, update: UpdateProfileRequest) async throws -> APIResponse<MeAggregate> {
        try await request(.patch, path: "/v1/me", body: update, token: token)
    }

    func createDevelopmentSession(input: DevelopmentSessionRequest) async throws -> APIResponse<DevelopmentSessionData> {
        try await request(.post, path: "/v1/dev/session", body: input)
    }

    // MARK: - Auth

    func sendEmailOtp(email: String) async throws -> APIResponse<EmailOtpResponse> {
        try await request(.post, path: "/v1/auth/email/otp", body: EmailOtpRequest(email: email))
    }

    func verifyEmailOtp(email: String, code: String) async throws -> APIResponse<AuthSessionData> {
        try await request(.post, path: "/v1/auth/email/verify", body: EmailVerifyRequest(email: email, token: code))
    }

    func refreshSession(refreshToken: String) async throws -> APIResponse<AuthSessionData> {
        try await request(.post, path: "/v1/auth/refresh", body: RefreshTokenRequest(refreshToken: refreshToken))
    }

    // MARK: - Situationships

    func getSituationships(token: String) async throws -> APIResponse<SituationshipListAggregate> {
        try await request(.get, path: "/v1/me/situationships", token: token)
    }

    func createSituationship(token: String, input: CreateSituationshipRequest) async throws -> APIResponse<SituationshipMutationData> {
        try await request(.post, path: "/v1/me/situationships", body: input, token: token)
    }

    func updateSituationship(token: String, id: String, input: UpdateSituationshipRequest) async throws -> APIResponse<SituationshipMutationData> {
        try await request(.patch, path: "/v1/me/situationships/\(id)", body: input, token: token)
    }

    func deleteSituationship(token: String, id: String) async throws -> APIResponse<DeletedData> {
        try await request(.delete, path: "/v1/me/situationships/\(id)", token: token)
    }

    func reorderSituationships(token: String, order: ReorderRequest) async throws -> APIResponse<ReorderResponseData> {
        try await request(.put, path: "/v1/me/situationships/order", body: order, token: token)
    }

    // MARK: - Voting

    func createVotingSession(token: String, input: CreateVotingSessionRequest = CreateVotingSessionRequest()) async throws -> APIResponse<CreateVotingSessionData> {
        try await request(.post, path: "/v1/me/voting-sessions", body: input, token: token)
    }

    func getVotingSessions(token: String) async throws -> APIResponse<OwnerVotingSessionsData> {
        try await request(.get, path: "/v1/me/voting-sessions", token: token)
    }

    func expireVotingSession(token: String, votingSessionId: String) async throws -> APIResponse<VotingSessionMutationData> {
        try await request(.post, path: "/v1/me/voting-sessions/\(votingSessionId)/expire", token: token)
    }

    func getPublicVotingSession(inviteCode: String) async throws -> APIResponse<PublicVotingSessionAggregate> {
        try await request(.get, path: "/v1/voting-sessions/\(inviteCode)")
    }

    func submitVote(inviteCode: String, input: SubmitVoteRequest) async throws -> APIResponse<SubmitVoteData> {
        try await request(.post, path: "/v1/voting-sessions/\(inviteCode)/votes", body: input)
    }

    func getVotingResults(token: String, votingSessionId: String) async throws -> APIResponse<VoteResultsAggregate> {
        try await request(.get, path: "/v1/me/voting-sessions/\(votingSessionId)/results", token: token)
    }
}

// MARK: - Supporting Types

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

struct APIResponse<T: Decodable>: Decodable {
    let data: T
}

struct SituationshipMutationData: Decodable {
    let situationship: Situationship
}

struct DeletedData: Decodable {
    let situationshipId: String
    let deleted: Bool
}

struct ReorderResponseData: Decodable {
    let ordering: Ordering
    let items: [Situationship]
}

struct DevelopmentSessionRequest: Encodable {
    var profileId: String
    var username: String
    var displayName: String
    var email: String?
    var privacy: ProfilePrivacy
}

struct DevelopmentSessionData: Decodable {
    let accessToken: String
    let me: MeAggregate
    let development: Bool
}

// MARK: - Auth Types

struct EmailOtpRequest: Encodable {
    let email: String
}

struct EmailOtpResponse: Decodable {
    let sent: Bool
    let email: String
}

struct EmailVerifyRequest: Encodable {
    let email: String
    let token: String
}

struct AuthSessionData: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int?
    let me: MeAggregate
}

struct RefreshTokenRequest: Encodable {
    let refreshToken: String
}

struct APIErrorEnvelope: Decodable {
    let error: APIErrorDetail
}

struct APIErrorDetail: Decodable {
    let code: String
    let message: String
    let requestId: String
}

enum APIError: LocalizedError {
    case invalidResponse
    case httpError(statusCode: Int)
    case server(code: String, message: String, statusCode: Int)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Invalid server response"
        case .httpError(let code): "Request failed (\(code))"
        case .server(_, let message, _): message
        case .unauthorized: "Please sign in again"
        }
    }
}

struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}

enum Configuration {
    static var apiBaseURL: String {
        if let environmentValue = ProcessInfo.processInfo.environment["HINTO_API_BASE_URL"],
           !environmentValue.isEmpty {
            return environmentValue
        }

        if let infoValue = Bundle.main.object(forInfoDictionaryKey: "HINTOAPIBaseURL") as? String,
           !infoValue.isEmpty {
            return infoValue
        }

        #if DEBUG
        return "http://127.0.0.1:3000"
        #else
        return "https://api.hinto.app"
        #endif
    }
}
