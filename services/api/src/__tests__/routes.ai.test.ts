import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import { createMockSupabaseClient, mockAuthenticatedUser, MockSupabaseClient } from './helpers/supabase';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

let mockClient: MockSupabaseClient;

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CONVERSATION_ID = '11111111-2222-3333-4444-555555555555';

const CONVERSATION_ROW = {
  id: CONVERSATION_ID,
  user_id: TEST_USER_ID,
  situationship_id: null,
  title: 'Chat with HINTO',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

/**
 * Queue a sequence of results for a table (same helper style as routes.voting.test.ts).
 */
function queueTableResults(
  client: MockSupabaseClient,
  table: string,
  results: Array<{ data: unknown; error: unknown }>,
): void {
  const builder = client._getBuilder(table);
  const queue = [...results];
  (builder as unknown as { then: Function }).then = function (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void,
  ) {
    const next = queue.shift() ?? { data: null, error: null };
    return Promise.resolve(next).then(resolve, reject);
  };
}

beforeEach(() => {
  mockClient = createMockSupabaseClient();
  (getServiceClient as jest.Mock).mockReturnValue(mockClient);
  mockAuthenticatedUser(mockClient, { userId: TEST_USER_ID });
});

afterEach(() => {
  jest.clearAllMocks();
  if (typeof (global as unknown as { fetch?: unknown }).fetch === 'function') {
    // Clean up anything test added.
  }
  delete (global as unknown as { fetch?: unknown }).fetch;
});

function dispatchAndWait(
  method: string,
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    skipAuth?: boolean;
    config?: ReturnType<typeof createTestConfig>;
  } = {},
) {
  const defaultHeaders = options.skipAuth
    ? { ...options.headers }
    : { authorization: 'Bearer valid-token', ...options.headers };
  const req = createMockRequest({ method, url, headers: defaultHeaders, body: options.body });
  const res = createMockResponse();
  const ctx = createTestContext();
  const cfg = options.config ?? createTestConfig();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, cfg);
  });
}

// ─────────────────────────────────────────────────────────────
// GET /v1/me/conversations
// ─────────────────────────────────────────────────────────────

describe('GET /v1/me/conversations', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait('GET', '/v1/me/conversations', { skipAuth: true });
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns the list of user conversations', async () => {
    mockClient._mockTable('ai_conversations', {
      data: [CONVERSATION_ROW],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me/conversations');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: { conversations: Array<{ conversationId: string; title: string | null }> };
    };
    expect(body.data.conversations).toHaveLength(1);
    expect(body.data.conversations[0].conversationId).toBe(CONVERSATION_ID);
    expect(body.data.conversations[0].title).toBe('Chat with HINTO');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /v1/me/conversations
// ─────────────────────────────────────────────────────────────

describe('POST /v1/me/conversations', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait('POST', '/v1/me/conversations', {
      skipAuth: true,
      body: {},
    });
    expect(res._getStatusCode()).toBe(401);
  });

  test('creates a conversation successfully', async () => {
    mockClient._mockTable('ai_conversations', {
      data: CONVERSATION_ROW,
      error: null,
    });

    const res = await dispatchAndWait('POST', '/v1/me/conversations', {
      body: { title: 'Chat with HINTO' },
    });
    expect(res._getStatusCode()).toBe(201);

    const body = res._getJson() as {
      data: { conversation: { conversationId: string; title: string | null } };
    };
    expect(body.data.conversation.conversationId).toBe(CONVERSATION_ID);
    expect(body.data.conversation.title).toBe('Chat with HINTO');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /v1/me/conversations/:id/messages
// ─────────────────────────────────────────────────────────────

describe('POST /v1/me/conversations/:id/messages', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait(
      'POST',
      `/v1/me/conversations/${CONVERSATION_ID}/messages`,
      { skipAuth: true, body: { content: 'hello' } },
    );
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns 404 when conversation is not owned by the user', async () => {
    mockClient._mockTable('ai_conversations', {
      data: null,
      error: { message: 'not found' },
    });

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/conversations/${CONVERSATION_ID}/messages`,
      { body: { content: 'hello coach' } },
    );
    expect(res._getStatusCode()).toBe(404);
  });

  test('returns 429 when daily quota is exhausted', async () => {
    mockClient._mockTable('ai_conversations', { data: CONVERSATION_ROW, error: null });
    mockClient._mockTable('daily_usage', {
      data: {
        id: 'usage-row',
        user_id: TEST_USER_ID,
        date: new Date().toISOString().slice(0, 10),
        ai_messages_used: 30,
      },
      error: null,
    });

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/conversations/${CONVERSATION_ID}/messages`,
      { body: { content: 'need advice' } },
    );
    expect(res._getStatusCode()).toBe(429);

    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('quota_exceeded');
  });

  test('inserts user + mocked assistant reply when OPENAI_API_KEY is unset', async () => {
    mockClient._mockTable('ai_conversations', { data: CONVERSATION_ROW, error: null });
    // No usage row yet.
    mockClient._mockTable('daily_usage', { data: null, error: null });

    const now = '2026-04-17T12:00:00Z';
    // ai_messages table is hit three times in this flow:
    //   1) insert user message → single row
    //   2) select history → array
    //   3) insert assistant message → single row
    queueTableResults(mockClient, 'ai_messages', [
      {
        data: {
          id: 'msg-user-1',
          conversation_id: CONVERSATION_ID,
          content: 'need advice',
          is_user: true,
          tokens_used: 0,
          moderation_flagged: false,
          created_at: now,
        },
        error: null,
      },
      {
        data: [
          {
            id: 'msg-user-1',
            conversation_id: CONVERSATION_ID,
            content: 'need advice',
            is_user: true,
            tokens_used: 0,
            moderation_flagged: false,
            created_at: now,
          },
        ],
        error: null,
      },
      {
        data: {
          id: 'msg-assistant-1',
          conversation_id: CONVERSATION_ID,
          content: 'AI coach is not configured in this environment.',
          is_user: false,
          tokens_used: 0,
          moderation_flagged: false,
          created_at: now,
        },
        error: null,
      },
    ]);

    // No fetch mock installed: if the handler called fetch, it'd throw.

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/conversations/${CONVERSATION_ID}/messages`,
      { body: { content: 'need advice' } },
    );

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as {
      data: {
        userMessage: { content: string; isUser: boolean };
        assistantMessage: { content: string; isUser: boolean };
        dailyUsage: { aiMessagesUsed: number; limit: number };
      };
    };

    expect(body.data.userMessage.content).toBe('need advice');
    expect(body.data.userMessage.isUser).toBe(true);
    expect(body.data.assistantMessage.content).toBe(
      'AI coach is not configured in this environment.',
    );
    expect(body.data.assistantMessage.isUser).toBe(false);
    expect(body.data.dailyUsage.aiMessagesUsed).toBe(1);
    expect(body.data.dailyUsage.limit).toBe(30);

    const dailyUsageBuilder = mockClient._getBuilder('daily_usage');
    expect(dailyUsageBuilder.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = dailyUsageBuilder.upsert.mock.calls[0];
    expect(upsertArgs?.[0]).toMatchObject({
      user_id: TEST_USER_ID,
      ai_messages_used: 1,
    });
    expect(upsertArgs?.[1]).toEqual({ onConflict: 'user_id,date' });
  });

  test('calls OpenAI and persists assistant reply when OPENAI_API_KEY is set', async () => {
    const apiKey = 'sk-test-123';
    const config = createTestConfig({ openAiApiKey: apiKey });

    mockClient._mockTable('ai_conversations', { data: CONVERSATION_ROW, error: null });
    mockClient._mockTable('daily_usage', { data: null, error: null });

    const now = '2026-04-17T13:00:00Z';
    queueTableResults(mockClient, 'ai_messages', [
      {
        data: {
          id: 'msg-user-2',
          conversation_id: CONVERSATION_ID,
          content: 'what should I do?',
          is_user: true,
          tokens_used: 0,
          moderation_flagged: false,
          created_at: now,
        },
        error: null,
      },
      {
        data: [
          {
            id: 'msg-user-2',
            conversation_id: CONVERSATION_ID,
            content: 'what should I do?',
            is_user: true,
            tokens_used: 0,
            moderation_flagged: false,
            created_at: now,
          },
        ],
        error: null,
      },
      {
        data: {
          id: 'msg-assistant-2',
          conversation_id: CONVERSATION_ID,
          content: 'Talk to them in person.',
          is_user: false,
          tokens_used: 42,
          moderation_flagged: false,
          created_at: now,
        },
        error: null,
      },
    ]);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Talk to them in person.' } }],
        usage: { total_tokens: 42 },
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/conversations/${CONVERSATION_ID}/messages`,
      { body: { content: 'what should I do?' }, config },
    );

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as {
      data: {
        userMessage: { content: string };
        assistantMessage: { content: string; tokensUsed: number };
      };
    };
    expect(body.data.userMessage.content).toBe('what should I do?');
    expect(body.data.assistantMessage.content).toBe('Talk to them in person.');
    expect(body.data.assistantMessage.tokensUsed).toBe(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${apiKey}`);
    expect(headers['content-type']).toBe('application/json');
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe('gpt-4o-mini');
    expect(Array.isArray(payload.messages)).toBe(true);
    expect(payload.messages[0].role).toBe('system');
  });
});
