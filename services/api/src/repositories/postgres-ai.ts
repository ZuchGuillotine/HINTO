import { AppConfig } from '../types.js';
import { queryOne, queryRows } from '../db.js';

/**
 * RDS Postgres persistence for the AI coach. Tables are defined in
 * db/migrations/002_hinto_product_core.sql (ai_conversations, ai_messages,
 * daily_usage). Every query is scoped by the owning profile id so a
 * conversation can never be read or written across accounts.
 */

export interface AiConversationRow {
  id: string;
  user_id: string;
  situationship_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessageRow {
  id: string;
  conversation_id: string;
  content: string;
  is_user: boolean;
  tokens_used: number | null;
  moderation_flagged: boolean | null;
  created_at: string;
}

const CONVERSATION_COLUMNS =
  'id, user_id, situationship_id, title, created_at::text AS created_at, updated_at::text AS updated_at';
const MESSAGE_COLUMNS =
  'id, conversation_id, content, is_user, tokens_used, moderation_flagged, created_at::text AS created_at';

export async function listConversationsForProfile(
  config: AppConfig,
  profileId: string,
  limit = 100,
): Promise<AiConversationRow[]> {
  return queryRows<AiConversationRow>(
    config,
    `SELECT ${CONVERSATION_COLUMNS}
       FROM ai_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [profileId, limit],
  );
}

export async function createConversation(
  config: AppConfig,
  profileId: string,
  input: { situationshipId: string | null; title: string | null },
): Promise<AiConversationRow | null> {
  return queryOne<AiConversationRow>(
    config,
    `INSERT INTO ai_conversations (user_id, situationship_id, title)
     VALUES ($1, $2, $3)
     RETURNING ${CONVERSATION_COLUMNS}`,
    [profileId, input.situationshipId, input.title],
  );
}

export async function getConversationForProfile(
  config: AppConfig,
  profileId: string,
  conversationId: string,
): Promise<AiConversationRow | null> {
  return queryOne<AiConversationRow>(
    config,
    `SELECT ${CONVERSATION_COLUMNS}
       FROM ai_conversations
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [conversationId, profileId],
  );
}

export async function deleteConversationForProfile(
  config: AppConfig,
  profileId: string,
  conversationId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `DELETE FROM ai_conversations
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [conversationId, profileId],
  );
  return Boolean(row);
}

export async function touchConversation(
  config: AppConfig,
  profileId: string,
  conversationId: string,
  title: string | null,
): Promise<void> {
  await queryOne(
    config,
    `UPDATE ai_conversations
        SET updated_at = timezone('utc'::text, now()),
            title = COALESCE(title, $3)
      WHERE id = $1 AND user_id = $2
      RETURNING id`,
    [conversationId, profileId, title],
  );
}

export async function listMessagesForConversation(
  config: AppConfig,
  conversationId: string,
  limit = 500,
): Promise<AiMessageRow[]> {
  return queryRows<AiMessageRow>(
    config,
    `SELECT ${MESSAGE_COLUMNS}
       FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2`,
    [conversationId, limit],
  );
}

export async function listRecentMessagesForConversation(
  config: AppConfig,
  conversationId: string,
  limit: number,
): Promise<AiMessageRow[]> {
  const rows = await queryRows<AiMessageRow>(
    config,
    `SELECT ${MESSAGE_COLUMNS}
       FROM ai_messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [conversationId, limit],
  );
  return rows.slice().reverse();
}

export async function insertMessage(
  config: AppConfig,
  input: {
    conversationId: string;
    content: string;
    isUser: boolean;
    tokensUsed: number;
    moderationFlagged: boolean;
  },
): Promise<AiMessageRow | null> {
  return queryOne<AiMessageRow>(
    config,
    `INSERT INTO ai_messages (conversation_id, content, is_user, tokens_used, moderation_flagged)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${MESSAGE_COLUMNS}`,
    [input.conversationId, input.content, input.isUser, input.tokensUsed, input.moderationFlagged],
  );
}

export async function getAiMessagesUsedToday(
  config: AppConfig,
  profileId: string,
): Promise<number> {
  const row = await queryOne<{ ai_messages_used: number }>(
    config,
    `SELECT ai_messages_used
       FROM daily_usage
      WHERE user_id = $1 AND date = current_date
      LIMIT 1`,
    [profileId],
  );
  return row?.ai_messages_used ?? 0;
}

export async function incrementAiMessagesUsedToday(
  config: AppConfig,
  profileId: string,
): Promise<number> {
  const row = await queryOne<{ ai_messages_used: number }>(
    config,
    `INSERT INTO daily_usage (user_id, date, ai_messages_used)
     VALUES ($1, current_date, 1)
     ON CONFLICT (user_id, date)
     DO UPDATE SET ai_messages_used = daily_usage.ai_messages_used + 1
     RETURNING ai_messages_used`,
    [profileId],
  );
  return row?.ai_messages_used ?? 1;
}
