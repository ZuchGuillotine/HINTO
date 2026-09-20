import Foundation

struct ChatMessage: Identifiable, Equatable {
    let id: String
    let text: String
    let isUser: Bool
    let timestamp: Date
    var isStreaming: Bool

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }

    static func userMessage(_ text: String) -> ChatMessage {
        ChatMessage(
            id: UUID().uuidString,
            text: text,
            isUser: true,
            timestamp: Date(),
            isStreaming: false
        )
    }

    static func aiMessage(_ text: String, streaming: Bool = false) -> ChatMessage {
        ChatMessage(
            id: UUID().uuidString,
            text: text,
            isUser: false,
            timestamp: Date(),
            isStreaming: streaming
        )
    }

    /// Maps a persisted API message onto the view model used by `ChatBubbleView`.
    init(apiMessage: AIMessage, streaming: Bool = false) {
        self.id = apiMessage.messageId
        self.text = apiMessage.content
        self.isUser = apiMessage.isUser
        self.timestamp = apiMessage.createdAtDate ?? Date()
        self.isStreaming = streaming
    }

    init(id: String, text: String, isUser: Bool, timestamp: Date, isStreaming: Bool) {
        self.id = id
        self.text = text
        self.isUser = isUser
        self.timestamp = timestamp
        self.isStreaming = isStreaming
    }
}

// MARK: - API Contracts (`/v1/me/conversations`)

struct AIConversation: Codable, Identifiable, Equatable {
    let conversationId: String
    let userId: String
    let situationshipId: String?
    let title: String?
    let createdAt: String
    let updatedAt: String
    var messageCount: Int? = nil

    var id: String { conversationId }
}

struct AIMessage: Codable, Identifiable, Equatable {
    let messageId: String
    let conversationId: String
    let content: String
    let isUser: Bool
    var tokensUsed: Int? = nil
    var moderationFlagged: Bool? = nil
    let createdAt: String

    var id: String { messageId }

    var createdAtDate: Date? {
        ISO8601Parsing.date(from: createdAt)
    }
}

struct AIDailyUsage: Codable, Equatable {
    let aiMessagesUsed: Int
    let limit: Int

    var remaining: Int {
        max(0, limit - aiMessagesUsed)
    }
}

struct ConversationListData: Decodable {
    let conversations: [AIConversation]
}

struct CreateConversationRequest: Encodable {
    var situationshipId: String? = nil
    var title: String? = nil
}

struct ConversationMutationData: Decodable {
    let conversation: AIConversation
}

struct ConversationDetailData: Decodable {
    let conversation: AIConversation
    let messages: [AIMessage]
}

struct DeleteConversationData: Decodable {
    let conversationId: String
    let deleted: Bool
}

struct SendConversationMessageRequest: Encodable {
    let content: String
}

struct SendConversationMessageData: Decodable {
    let userMessage: AIMessage
    let assistantMessage: AIMessage
    let dailyUsage: AIDailyUsage
}

/// The API emits ISO-8601 timestamps with and without fractional seconds.
enum ISO8601Parsing {
    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(from string: String) -> Date? {
        fractional.date(from: string) ?? plain.date(from: string)
    }
}
