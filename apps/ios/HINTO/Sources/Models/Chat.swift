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
}

struct AIConversation: Codable, Identifiable {
    let conversationId: String
    let profileId: String
    let createdAt: String
    let updatedAt: String

    var id: String { conversationId }
}

struct AIMessagePayload: Codable {
    let conversationId: String
    let content: String
}
