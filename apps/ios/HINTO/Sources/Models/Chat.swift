import Foundation

// MARK: - UI model

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
}

extension ChatMessage {
    init(aiMessage: AiMessage, streaming: Bool = false) {
        self.init(
            id: aiMessage.messageId,
            text: aiMessage.content,
            isUser: aiMessage.role == .user,
            timestamp: HINTODate.parse(aiMessage.createdAt) ?? Date(),
            isStreaming: streaming
        )
    }
}

// MARK: - API DTOs (packages/contracts/src/ai.ts)

enum AiMessageRole: String, Codable {
    case user
    case assistant
}

struct AiConversation: Codable, Identifiable, Equatable {
    let conversationId: String
    let situationshipId: String?
    let title: String?
    let createdAt: String
    let updatedAt: String

    var id: String { conversationId }
}

struct AiMessage: Codable, Identifiable, Equatable {
    let messageId: String
    let conversationId: String
    let role: AiMessageRole
    let content: String
    /// True when the message was blocked or softened by moderation.
    let moderationFlagged: Bool
    let createdAt: String

    var id: String { messageId }

    enum CodingKeys: String, CodingKey {
        case messageId
        case conversationId
        case role
        case content
        case moderationFlagged
        case createdAt
    }
}

extension AiMessage {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        messageId = try container.decode(String.self, forKey: .messageId)
        conversationId = try container.decode(String.self, forKey: .conversationId)
        role = try container.decode(AiMessageRole.self, forKey: .role)
        content = try container.decode(String.self, forKey: .content)
        moderationFlagged = try container.decodeIfPresent(Bool.self, forKey: .moderationFlagged) ?? false
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
    }
}

struct AiUsage: Codable, Equatable {
    /// Messages the user has sent today.
    let used: Int
    /// Daily cap for the user's tier.
    let limit: Int
    let remaining: Int
}

struct ListAiConversationsData: Decodable {
    let conversations: [AiConversation]
    let usage: AiUsage
}

struct CreateAiConversationRequest: Encodable {
    var situationshipId: String? = nil
    var title: String? = nil
}

struct CreateAiConversationData: Decodable {
    let conversation: AiConversation
}

struct ListAiMessagesData: Decodable {
    let conversation: AiConversation
    let messages: [AiMessage]
}

struct SendAiMessageRequest: Encodable {
    let content: String
}

struct SendAiMessageData: Decodable {
    let conversation: AiConversation
    let userMessage: AiMessage
    let assistantMessage: AiMessage
    let usage: AiUsage
}
