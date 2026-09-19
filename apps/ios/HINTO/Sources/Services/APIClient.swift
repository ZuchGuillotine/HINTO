import Foundation
import Observation

@Observable
final class APIClient {
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let sessionStore: SessionStore

    var baseURL: URL {
        URL(string: Configuration.apiBaseURL) ?? URL(string: Configuration.productionBaseURL)!
    }

    init(sessionStore: SessionStore = .shared) {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
        self.sessionStore = sessionStore
    }

    // MARK: - Generic Request

    /// Performs a JSON request. When `token` is supplied and the server answers 401,
    /// the client refreshes the session once (`POST /v1/auth/refresh`) and retries once.
    /// If the refresh itself is rejected, the stored session is cleared and
    /// `.hintoSessionInvalidated` is posted so `AuthManager` can sign the user out.
    func request<T: Decodable>(
        _ method: HTTPMethod,
        path: String,
        body: (any Encodable)? = nil,
        token: String? = nil
    ) async throws -> T {
        let encodedBody = try body.map { try encoder.encode(AnyEncodable($0)) }

        var (data, httpResponse) = try await send(method, path: path, body: encodedBody, token: token)

        if httpResponse.statusCode == 401, let token {
            let freshToken = try await refreshedAccessToken(afterFailing: token)
            (data, httpResponse) = try await send(method, path: path, body: encodedBody, token: freshToken)
        }

        try Self.validate(httpResponse, data: data, decoder: decoder)
        return try decoder.decode(T.self, from: data)
    }

    private func send(
        _ method: HTTPMethod,
        path: String,
        body: Data?,
        token: String?
    ) async throws -> (Data, HTTPURLResponse) {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(normalizedPath)
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = body

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        return (data, httpResponse)
    }

    private func refreshedAccessToken(afterFailing failedToken: String) async throws -> String {
        // Another request may already have rotated the session; reuse its token.
        if let current = sessionStore.accessToken, current != failedToken {
            return current
        }
        return try await SessionRefresher.shared.refresh(store: sessionStore, baseURL: baseURL)
    }

    private static func validate(_ httpResponse: HTTPURLResponse, data: Data, decoder: JSONDecoder) throws {
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
    }

    // MARK: - Profile

    func getMe(token: String) async throws -> APIResponse<MeAggregate> {
        try await request(.get, path: "/v1/me", token: token)
    }

    func updateMe(token: String, update: UpdateProfileRequest) async throws -> APIResponse<MeAggregate> {
        try await request(.patch, path: "/v1/me", body: update, token: token)
    }

    /// Permanently deletes the auth user; profile and all owned rows cascade server-side.
    func deleteMe(token: String) async throws -> APIResponse<DeleteMeData> {
        try await request(.delete, path: "/v1/me", token: token)
    }

    #if DEBUG
    func createDevelopmentSession(input: DevelopmentSessionRequest) async throws -> APIResponse<DevelopmentSessionData> {
        try await request(.post, path: "/v1/dev/session", body: input)
    }
    #endif

    // MARK: - Auth

    func sendEmailOtp(email: String) async throws -> APIResponse<EmailOtpResponse> {
        try await request(.post, path: "/v1/auth/email/otp", body: EmailOtpRequest(email: email))
    }

    func verifyEmailOtp(email: String, code: String) async throws -> APIResponse<AuthSession> {
        try await request(.post, path: "/v1/auth/email/verify", body: EmailVerifyRequest(email: email, token: code))
    }

    func refreshSession(refreshToken: String) async throws -> APIResponse<AuthSession> {
        try await request(.post, path: "/v1/auth/refresh", body: RefreshTokenRequest(refreshToken: refreshToken))
    }

    /// Exchanges an Apple identity token for an API session.
    func signInWithApple(input: AppleSignInRequest) async throws -> APIResponse<AuthSession> {
        try await request(.post, path: "/v1/auth/apple", body: input)
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

    // MARK: - Moderation

    func createReport(token: String, input: CreateReportRequest) async throws -> APIResponse<CreateReportData> {
        try await request(.post, path: "/v1/reports", body: input, token: token)
    }

    func listBlocks(token: String) async throws -> APIResponse<ListBlocksData> {
        try await request(.get, path: "/v1/me/blocks", token: token)
    }

    func createBlock(token: String, input: CreateBlockRequest) async throws -> APIResponse<CreateBlockData> {
        try await request(.post, path: "/v1/me/blocks", body: input, token: token)
    }

    func deleteBlock(token: String, profileId: String) async throws -> APIResponse<DeleteBlockData> {
        try await request(.delete, path: "/v1/me/blocks/\(profileId)", token: token)
    }

    // MARK: - AI Coach

    func listAiConversations(token: String) async throws -> APIResponse<ListAiConversationsData> {
        try await request(.get, path: "/v1/me/ai/conversations", token: token)
    }

    func createAiConversation(token: String, input: CreateAiConversationRequest = CreateAiConversationRequest()) async throws -> APIResponse<CreateAiConversationData> {
        try await request(.post, path: "/v1/me/ai/conversations", body: input, token: token)
    }

    func listAiMessages(token: String, conversationId: String) async throws -> APIResponse<ListAiMessagesData> {
        try await request(.get, path: "/v1/me/ai/conversations/\(conversationId)/messages", token: token)
    }

    func sendAiMessage(token: String, conversationId: String, input: SendAiMessageRequest) async throws -> APIResponse<SendAiMessageData> {
        try await request(.post, path: "/v1/me/ai/conversations/\(conversationId)/messages", body: input, token: token)
    }
}

// MARK: - Session Refresh

/// Serialises concurrent refresh attempts so that several 401s arriving at once
/// perform a single `POST /v1/auth/refresh` and share its result.
actor SessionRefresher {
    static let shared = SessionRefresher()

    private var inFlight: Task<String, Error>?

    /// Returns a fresh access token, or throws `APIError.unauthorized` after clearing the
    /// stored session when the server rejects the refresh token. Network failures propagate
    /// without touching the stored session.
    func refresh(store: SessionStore, baseURL: URL) async throws -> String {
        if let inFlight {
            return try await inFlight.value
        }

        let task = Task<String, Error> {
            try await Self.performRefresh(store: store, baseURL: baseURL)
        }
        inFlight = task
        defer { inFlight = nil }
        return try await task.value
    }

    private static func performRefresh(store: SessionStore, baseURL: URL) async throws -> String {
        guard let refreshToken = store.refreshToken, !refreshToken.isEmpty else {
            invalidate(store)
            throw APIError.unauthorized
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("v1/auth/refresh"))
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(RefreshTokenRequest(refreshToken: refreshToken))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if (400...499).contains(httpResponse.statusCode) {
            // The refresh token is expired, revoked, or malformed: the session is gone.
            invalidate(store)
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let payload = try JSONDecoder().decode(APIResponse<AuthSession>.self, from: data)
        store.save(accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken)
        NotificationCenter.default.post(
            name: .hintoSessionRefreshed,
            object: nil,
            userInfo: ["me": payload.data.me]
        )
        return payload.data.accessToken
    }

    private static func invalidate(_ store: SessionStore) {
        store.clear()
        NotificationCenter.default.post(name: .hintoSessionInvalidated, object: nil)
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

struct APIErrorEnvelope: Decodable {
    let error: APIErrorDetail
}

struct APIErrorDetail: Decodable {
    let code: String
    let message: String
    let requestId: String?
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

    /// True when the server rejected the caller's credentials (as opposed to a network or server fault).
    var isAuthenticationFailure: Bool {
        switch self {
        case .unauthorized: true
        case .httpError(let statusCode): statusCode == 401 || statusCode == 403
        case .server(_, _, let statusCode): statusCode == 401 || statusCode == 403
        case .invalidResponse: false
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
    /// Production API host. Used only when neither the environment nor Info.plist provides a value.
    static let productionBaseURL = "https://api.hinto.app"

    /// Resolution order:
    /// 1. `HINTO_API_BASE_URL` process environment variable (Xcode scheme / CI override)
    /// 2. `HINTOAPIBaseURL` Info.plist key (set per build configuration in Project.swift)
    /// 3. `productionBaseURL`
    static var apiBaseURL: String {
        if let environmentValue = ProcessInfo.processInfo.environment["HINTO_API_BASE_URL"],
           !environmentValue.isEmpty {
            return environmentValue
        }

        if let infoValue = Bundle.main.object(forInfoDictionaryKey: "HINTOAPIBaseURL") as? String,
           !infoValue.isEmpty,
           !infoValue.hasPrefix("$(") {
            return infoValue
        }

        return productionBaseURL
    }
}
