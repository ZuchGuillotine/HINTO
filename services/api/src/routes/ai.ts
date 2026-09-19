import { IncomingMessage, ServerResponse } from 'node:http';

import {
  CRISIS_RESPONSE,
  buildCoachSystemPrompt,
  detectCrisisLanguage,
  CoachSituationshipContext,
  CoachVoteSummaryContext,
} from '@hinto/prompts';
import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { AuthenticatedContext, resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';
import { normalizeShortText } from './situationships.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_WINDOW = 20;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const OPENAI_TIMEOUT_MS = 30_000;

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

interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CoachCompletion {
  content: string;
  tokensUsed: number;
}

/**
 * Model call boundary. Tests replace this via `setCoachCompletionProvider`.
 */
export type CoachCompletionProvider = (
  turns: ChatTurn[],
  config: AppConfig
) => Promise<CoachCompletion>;

async function openAiCompletion(turns: ChatTurn[], config: AppConfig): Promise<CoachCompletion> {
  if (!config.openAiApiKey) {
    throw new AppError('ai_unavailable', 'AI coach is not configured', 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openAiModel,
        messages: turns,
        temperature: 0.7,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new AppError('ai_upstream_error', `Coach provider returned ${res.status}`, 502);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError('ai_upstream_error', 'Coach provider returned an empty reply', 502);
    }

    return { content, tokensUsed: payload.usage?.total_tokens ?? 0 };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('ai_upstream_error', 'Coach provider request failed', 502);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns true when the text should be blocked. Fails open on provider errors
 * so a moderation outage does not take the coach down; the crisis detector
 * still runs locally.
 */
async function isFlaggedByModeration(text: string, config: AppConfig): Promise<boolean> {
  if (!config.openAiApiKey) return false;
  try {
    const res = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openAiApiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });
    if (!res.ok) return false;
    const payload = (await res.json()) as { results?: { flagged?: boolean }[] };
    return Boolean(payload.results?.[0]?.flagged);
  } catch {
    return false;
  }
}

let completionProvider: CoachCompletionProvider = openAiCompletion;
let moderationProvider: (text: string, config: AppConfig) => Promise<boolean> =
  isFlaggedByModeration;

/** Test seam. */
export function setCoachCompletionProvider(provider: CoachCompletionProvider | null): void {
  completionProvider = provider ?? openAiCompletion;
}

/** Test seam. */
export function setCoachModerationProvider(
  provider: ((text: string, config: AppConfig) => Promise<boolean>) | null
): void {
  moderationProvider = provider ?? isFlaggedByModeration;
}

export function isAiCoachEnabled(config: AppConfig): boolean {
  return Boolean(config.openAiApiKey);
}

export function matchAiConversationPath(
  path: string
): { conversationId: string; action: 'messages' } | null {
  const match = path.match(/^\/v1\/me\/ai\/conversations\/([a-f0-9-]+)\/messages$/iu);
  return match ? { conversationId: match[1], action: 'messages' } : null;
}

function toConversationDto(row: ConversationRow) {
  return {
    conversationId: row.id,
    situationshipId: row.situationship_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessageDto(row: MessageRow) {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    role: row.is_user ? ('user' as const) : ('assistant' as const),
    content: row.content,
    moderationFlagged: Boolean(row.moderation_flagged),
    createdAt: row.created_at,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadUsage(authCtx: AuthenticatedContext, config: AppConfig): Promise<UsageSnapshot> {
  const supabase = getServiceClient(config);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', authCtx.user.profileId)
    .maybeSingle();

  const tier = (profile as { subscription_tier?: string | null } | null)?.subscription_tier;
  const limit =
    tier === 'premium' ? config.aiDailyMessageLimitPremium : config.aiDailyMessageLimitFree;

  const { data: usage } = await supabase
    .from('daily_usage')
    .select('ai_messages_used')
    .eq('user_id', authCtx.user.profileId)
    .eq('date', todayUtc())
    .maybeSingle();

  const used = (usage as { ai_messages_used?: number | null } | null)?.ai_messages_used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function loadOwnedConversation(
  authCtx: AuthenticatedContext,
  conversationId: string,
  config: AppConfig
): Promise<ConversationRow> {
  if (!UUID_RE.test(conversationId)) {
    throw new AppError('validation_error', 'conversationId must be a UUID', 400);
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', authCtx.user.profileId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError('not_found', 'Conversation not found', 404);
  }

  return data as ConversationRow;
}

async function buildUserContext(authCtx: AuthenticatedContext, config: AppConfig) {
  const supabase = getServiceClient(config);

  const [{ data: profile }, { data: situationships }] = await Promise.all([
    supabase.from('profiles').select('name, age').eq('id', authCtx.user.profileId).maybeSingle(),
    supabase
      .from('situationships')
      .select('id, name, emoji, category, description, rank, is_active')
      .eq('user_id', authCtx.user.profileId)
      .eq('is_active', true)
      .order('rank', { ascending: true }),
  ]);

  const items = (
    (situationships ?? []) as {
      id: string;
      name: string;
      emoji: string | null;
      category: string | null;
      description: string | null;
      rank: number;
    }[]
  ).map<CoachSituationshipContext & { id: string }>(row => ({
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    category: row.category,
    description: row.description,
    rank: row.rank,
  }));

  let recentVotes: CoachVoteSummaryContext[] = [];
  if (items.length > 0) {
    const { data: votes } = await supabase
      .from('votes')
      .select('situationship_id, vote_type')
      .in(
        'situationship_id',
        items.map(item => item.id)
      )
      .limit(500);

    const tally = new Map<string, { best: number; worst: number }>();
    for (const vote of (votes ?? []) as { situationship_id: string; vote_type: string }[]) {
      const entry = tally.get(vote.situationship_id) ?? { best: 0, worst: 0 };
      if (vote.vote_type === 'best_fit') entry.best += 1;
      if (vote.vote_type === 'not_the_one') entry.worst += 1;
      tally.set(vote.situationship_id, entry);
    }
    recentVotes = items
      .filter(item => tally.has(item.id))
      .map(item => ({
        situationshipName: item.name,
        bestVotes: tally.get(item.id)?.best ?? 0,
        worstVotes: tally.get(item.id)?.worst ?? 0,
      }));
  }

  const profileRow = profile as { name?: string | null; age?: number | null } | null;
  return {
    displayName: profileRow?.name ?? null,
    age: profileRow?.age ?? null,
    situationships: items,
    recentVotes,
  };
}

/**
 * GET /v1/me/ai/conversations
 */
export async function handleListAiConversations(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', authCtx.user.profileId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new AppError('fetch_failed', 'Failed to load conversations', 500);
  }

  const usage = await loadUsage(authCtx, config);

  sendJsonSuccess(response, 200, context.requestId, {
    conversations: ((data ?? []) as ConversationRow[]).map(toConversationDto),
    usage,
  });
}

/**
 * POST /v1/me/ai/conversations
 */
export async function handleCreateAiConversation(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!isAiCoachEnabled(config)) {
    throw new AppError('ai_unavailable', 'AI coach is not configured', 503);
  }

  const body = await readJsonBody(request);
  const title = normalizeShortText(body.title, 'title', 120);
  let situationshipId: string | null = null;
  if (body.situationshipId !== undefined && body.situationshipId !== null) {
    if (typeof body.situationshipId !== 'string' || !UUID_RE.test(body.situationshipId)) {
      throw new AppError('validation_error', 'situationshipId must be a UUID', 400);
    }
    situationshipId = body.situationshipId.toLowerCase();
  }

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
 * GET /v1/me/ai/conversations/:id/messages
 */
export async function handleListAiMessages(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  conversationId: string
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const conversation = await loadOwnedConversation(authCtx, conversationId, config);
  const supabase = getServiceClient(config);

  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    throw new AppError('fetch_failed', 'Failed to load messages', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    conversation: toConversationDto(conversation),
    messages: ((data ?? []) as MessageRow[]).map(toMessageDto),
  });
}

/**
 * POST /v1/me/ai/conversations/:id/messages
 */
export async function handleSendAiMessage(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  conversationId: string
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!isAiCoachEnabled(config)) {
    throw new AppError('ai_unavailable', 'AI coach is not configured', 503);
  }

  const body = await readJsonBody(request);
  const content = normalizeShortText(body.content, 'content', MAX_MESSAGE_LENGTH);
  if (!content) {
    throw new AppError('validation_error', 'content is required', 400);
  }

  const conversation = await loadOwnedConversation(authCtx, conversationId, config);
  const usage = await loadUsage(authCtx, config);
  if (usage.remaining <= 0) {
    throw new AppError('quota_exceeded', 'Daily coach message limit reached', 429, {
      used: usage.used,
      limit: usage.limit,
    });
  }

  const supabase = getServiceClient(config);
  const crisis = detectCrisisLanguage(content);
  const inputFlagged = crisis ? false : await moderationProvider(content, config);

  const { data: userRow, error: userError } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversation.id,
      content,
      is_user: true,
      moderation_flagged: inputFlagged || crisis,
    })
    .select('*')
    .single();

  if (userError || !userRow) {
    throw new AppError('create_failed', 'Failed to store message', 500);
  }

  let reply: CoachCompletion;
  let replyFlagged = false;

  if (crisis) {
    reply = { content: CRISIS_RESPONSE, tokensUsed: 0 };
    replyFlagged = true;
  } else if (inputFlagged) {
    reply = {
      content:
        "I can't help with that one, but I'm here if you want to talk about how you're feeling or what you want from this relationship.",
      tokensUsed: 0,
    };
    replyFlagged = true;
  } else {
    const { data: historyRows } = await supabase
      .from('ai_messages')
      .select('content, is_user, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW);

    const history = (
      (Array.isArray(historyRows) ? historyRows : []) as Pick<MessageRow, 'content' | 'is_user'>[]
    )
      .slice()
      .reverse()
      .map<ChatTurn>(row => ({ role: row.is_user ? 'user' : 'assistant', content: row.content }));

    // The just-inserted user message may or may not be in `history` depending
    // on timestamp ordering; ensure it is the final turn exactly once.
    if (history.length === 0 || history[history.length - 1].content !== content) {
      history.push({ role: 'user', content });
    }

    const userContext = await buildUserContext(authCtx, config);
    const turns: ChatTurn[] = [
      { role: 'system', content: buildCoachSystemPrompt(userContext) },
      ...history,
    ];

    reply = await completionProvider(turns, config);
    replyFlagged = await moderationProvider(reply.content, config);
    if (replyFlagged) {
      reply = {
        content:
          'Let me put that differently. What would feel like a healthy next step for you here?',
        tokensUsed: reply.tokensUsed,
      };
    }
  }

  const { data: assistantRow, error: assistantError } = await supabase
    .from('ai_messages')
    .insert({
      conversation_id: conversation.id,
      content: reply.content,
      is_user: false,
      tokens_used: reply.tokensUsed,
      moderation_flagged: replyFlagged,
    })
    .select('*')
    .single();

  if (assistantError || !assistantRow) {
    throw new AppError('create_failed', 'Failed to store reply', 500);
  }

  // Count the turn against the daily quota and bump the conversation.
  await supabase.rpc('increment_ai_usage', {
    p_user_id: authCtx.user.profileId,
    p_date: todayUtc(),
  });
  const updatedAt = new Date().toISOString();
  await supabase
    .from('ai_conversations')
    .update({ updated_at: updatedAt, title: conversation.title ?? content.slice(0, 60) })
    .eq('id', conversation.id);

  sendJsonSuccess(response, 200, context.requestId, {
    conversation: toConversationDto({
      ...conversation,
      updated_at: updatedAt,
      title: conversation.title ?? content.slice(0, 60),
    }),
    userMessage: toMessageDto(userRow as MessageRow),
    assistantMessage: toMessageDto(assistantRow as MessageRow),
    usage: {
      used: usage.used + 1,
      limit: usage.limit,
      remaining: Math.max(0, usage.remaining - 1),
    },
  });
}
