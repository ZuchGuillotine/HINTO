import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';
import {
  HINTO_AI_MODEL,
  buildCoachMessages,
  moderateCoachInput,
  type CoachMessage,
} from '../../../../packages/prompts/src/index.js';

export const DAILY_AI_MESSAGE_LIMIT = 30;

const OPENAI_MODEL = HINTO_AI_MODEL;
const OPENAI_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MOCK_ASSISTANT_REPLY = 'AI coach is not configured in this environment.';
const MAX_HISTORY_MESSAGES = 10;
const MAX_CONTENT_LENGTH = 4000;

interface ConversationRow {
  id: string;
  user_id: string;
  situationship_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  content: string;
  is_user: boolean;
  tokens_used: number | null;
  moderation_flagged: boolean | null;
  created_at: string;
}

interface DailyUsageRow {
  id?: string;
  user_id: string;
  date: string;
  ai_messages_used: number;
  votes_created?: number;
  voting_sessions_created?: number;
}

function toConversationDto(row: ConversationRow, messageCount?: number) {
  return {
    conversationId: row.id,
    userId: row.user_id,
    situationshipId: row.situationship_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(messageCount !== undefined ? { messageCount } : {}),
  };
}

function toMessageDto(row: MessageRow) {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    isUser: row.is_user,
    tokensUsed: row.tokens_used ?? 0,
    moderationFlagged: row.moderation_flagged ?? false,
    createdAt: row.created_at,
  };
}

/**
 * Prompt-package wrapper kept local so existing route tests can exercise the
 * API-facing moderation shape without knowing package internals.
 */
export function moderateContent(content: string): { flagged: boolean; reason: string | null } {
  const moderation = moderateCoachInput(content);
  return { flagged: moderation.flagged, reason: moderation.reason };
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getConversationForUser(
  config: AppConfig,
  conversationId: string,
  userId: string,
): Promise<ConversationRow> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Conversation not found', 404);
  }

  return data as ConversationRow;
}

interface OpenAiResult {
  content: string;
  tokensUsed: number;
}

async function callOpenAi(
  apiKey: string,
  latestUserMessage: string,
  history: CoachMessage[],
): Promise<OpenAiResult> {
  const payload = {
    model: OPENAI_MODEL,
    messages: buildCoachMessages({
      latestUserMessage,
      history,
    }),
  };

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new AppError(
      'ai_request_failed',
      err instanceof Error ? err.message : 'Failed to reach AI provider',
      502,
    );
  }

  if (!response.ok) {
    throw new AppError('ai_request_failed', `AI provider returned ${response.status}`, 502);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new AppError('ai_request_failed', 'AI provider returned invalid JSON', 502);
  }

  const parsed = json as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new AppError('ai_request_failed', 'AI provider returned empty response', 502);
  }

  return {
    content: content.trim(),
    tokensUsed:
      typeof parsed.usage?.total_tokens === 'number' && Number.isFinite(parsed.usage.total_tokens)
        ? parsed.usage.total_tokens
        : 0,
  };
}

/**
 * GET /v1/me/conversations - List the authenticated user's conversations.
 */
export async function handleListConversations(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', authCtx.user.profileId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch conversations', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    conversations: ((data ?? []) as ConversationRow[]).map((row) => toConversationDto(row)),
  });
}

/**
 * POST /v1/me/conversations - Create a new conversation.
 */
export async function handleCreateConversation(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  const situationshipId =
    typeof body.situationshipId === 'string' && body.situationshipId.trim().length > 0
      ? body.situationshipId.trim()
      : null;

  const title =
    typeof body.title === 'string' && body.title.trim().length > 0 ? body.title.trim() : null;

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: authCtx.user.profileId,
      situationship_id: situationshipId,
      title,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('create_failed', 'Failed to create conversation', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    conversation: toConversationDto(data as ConversationRow),
  });
}

/**
 * GET /v1/me/conversations/:id - Fetch a conversation and its ordered messages.
 */
export async function handleGetConversation(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  conversationId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const conversation = await getConversationForUser(
    config,
    conversationId,
    authCtx.user.profileId,
  );

  const supabase = getServiceClient(config);
  const { data: messages, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch conversation messages', 500);
  }

  const messageRows = (messages ?? []) as MessageRow[];

  sendJsonSuccess(response, 200, context.requestId, {
    conversation: toConversationDto(conversation, messageRows.length),
    messages: messageRows.map(toMessageDto),
  });
}

/**
 * DELETE /v1/me/conversations/:id - Delete a conversation (cascades messages).
 */
export async function handleDeleteConversation(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  conversationId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  await getConversationForUser(config, conversationId, authCtx.user.profileId);

  const supabase = getServiceClient(config);
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', authCtx.user.profileId);

  if (error) {
    throw new AppError('delete_failed', 'Failed to delete conversation', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    conversationId,
    deleted: true,
  });
}

/**
 * POST /v1/me/conversations/:id/messages - Send a user message, get assistant reply.
 */
export async function handleSendMessage(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  conversationId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  if (typeof body.content !== 'string' || body.content.trim().length === 0) {
    throw new AppError('validation_error', 'content is required', 400);
  }
  if ((body.content as string).length > MAX_CONTENT_LENGTH) {
    throw new AppError(
      'validation_error',
      `content must be ${MAX_CONTENT_LENGTH} characters or fewer`,
      400,
    );
  }

  const content = (body.content as string).trim();
  const userId = authCtx.user.profileId;

  await getConversationForUser(config, conversationId, userId);

  const supabase = getServiceClient(config);
  const today = todayDateString();

  // ── Quota check ────────────────────────────────────────────
  const { data: usageRow, error: usageError } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (usageError) {
    throw new AppError('fetch_failed', 'Failed to check daily usage', 500);
  }

  const currentUsage = (usageRow as DailyUsageRow | null)?.ai_messages_used ?? 0;
  if (currentUsage >= DAILY_AI_MESSAGE_LIMIT) {
    throw new AppError(
      'quota_exceeded',
      `Daily AI message limit of ${DAILY_AI_MESSAGE_LIMIT} reached`,
      429,
    );
  }

  // ── Moderation + user message insert ───────────────────────
  const moderation = moderateCoachInput(content);

  const { data: insertedUser, error: userInsertError } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      content,
      is_user: true,
      tokens_used: 0,
      moderation_flagged: moderation.flagged,
    })
    .select('*')
    .single();

  if (userInsertError || !insertedUser) {
    throw new AppError('create_failed', 'Failed to store user message', 500);
  }

  const userMessage = insertedUser as MessageRow;

  if (moderation.flagged) {
    // Intentionally non-blocking — just log for ops visibility.
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'ai_moderation_flagged',
        requestId: context.requestId,
        conversationId,
        userId,
        reason: moderation.reason,
        category: moderation.category,
      }),
    );
  }

  // ── Get assistant reply (real or mocked) ───────────────────
  let assistantContent: string;
  let assistantTokens = 0;

  if (moderation.emergencyResponse) {
    assistantContent = moderation.emergencyResponse;
  } else {
    // ── Load recent history for the model ────────────────────
    const { data: historyRows, error: historyError } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (historyError) {
      throw new AppError('fetch_failed', 'Failed to load conversation history', 500);
    }

    const historyAsc = ((historyRows ?? []) as MessageRow[])
      .slice()
      .reverse()
      .filter((row) => row.id !== userMessage.id);
    const history: CoachMessage[] = historyAsc.map((row) => ({
      role: row.is_user ? ('user' as const) : ('assistant' as const),
      content: row.content,
    }));

    if (config.openAiApiKey) {
      const result = await callOpenAi(config.openAiApiKey, content, history);
      assistantContent = result.content;
      assistantTokens = result.tokensUsed;
    } else {
      assistantContent = MOCK_ASSISTANT_REPLY;
    }
  }

  const { data: insertedAssistant, error: assistantInsertError } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversationId,
      content: assistantContent,
      is_user: false,
      tokens_used: assistantTokens,
      moderation_flagged: false,
    })
    .select('*')
    .single();

  if (assistantInsertError || !insertedAssistant) {
    throw new AppError('create_failed', 'Failed to store assistant message', 500);
  }

  const assistantMessage = insertedAssistant as MessageRow;

  // ── Update daily usage (upsert by (user_id, date)) ─────────
  const { error: usageUpsertError } = await supabase
    .from('daily_usage')
    .upsert(
      {
        user_id: userId,
        date: today,
        ai_messages_used: currentUsage + 1,
      },
      { onConflict: 'user_id,date' },
    );

  if (usageUpsertError) {
    // Non-fatal — the conversation was saved; just log so ops can investigate.
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'ai_daily_usage_upsert_failed',
        requestId: context.requestId,
        userId,
      }),
    );
  }

  // ── Touch conversation updated_at ──────────────────────────
  await supabase
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId);

  sendJsonSuccess(response, 201, context.requestId, {
    userMessage: toMessageDto(userMessage),
    assistantMessage: toMessageDto(assistantMessage),
    dailyUsage: {
      aiMessagesUsed: currentUsage + 1,
      limit: DAILY_AI_MESSAGE_LIMIT,
    },
  });
}
