/**
 * AI coach contracts.
 *
 * Routes:
 * - GET  /v1/me/ai/conversations
 * - POST /v1/me/ai/conversations
 * - GET  /v1/me/ai/conversations/:conversationId/messages
 * - POST /v1/me/ai/conversations/:conversationId/messages
 */

export type AiMessageRole = 'user' | 'assistant';

export interface AiConversationDto {
  conversationId: string;
  situationshipId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessageDto {
  messageId: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  /** True when the message was blocked or softened by moderation. */
  moderationFlagged: boolean;
  createdAt: string;
}

export interface AiUsageDto {
  /** Messages the user has sent today. */
  used: number;
  /** Daily cap for the user's tier. */
  limit: number;
  remaining: number;
}

export interface ListAiConversationsResponseDto {
  data: {
    conversations: AiConversationDto[];
    usage: AiUsageDto;
  };
}

export interface CreateAiConversationRequestDto {
  situationshipId?: string | null;
  title?: string | null;
}

export interface CreateAiConversationResponseDto {
  data: {
    conversation: AiConversationDto;
  };
}

export interface ListAiMessagesResponseDto {
  data: {
    conversation: AiConversationDto;
    messages: AiMessageDto[];
  };
}

export interface SendAiMessageRequestDto {
  content: string;
}

export interface SendAiMessageResponseDto {
  data: {
    conversation: AiConversationDto;
    userMessage: AiMessageDto;
    assistantMessage: AiMessageDto;
    usage: AiUsageDto;
  };
}
