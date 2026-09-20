import { routeRequest } from '../routes';
import { queryOne, queryRows } from '../db';
import { resetRateLimits } from '../rate-limit';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';

// The RDS path is active whenever DATABASE_URL is set outside `test`; the
// repository layer is mocked so the SQL contract is exercised without a DB.
jest.mock('../db', () => ({
  shouldUsePostgres: jest.fn(() => true),
  queryOne: jest.fn(),
  queryRows: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(() => {
    throw new Error('Supabase must not be used on the Postgres path');
  }),
  getUserClient: jest.fn(),
}));
jest.mock('../repositories/postgres-auth', () => ({
  resolvePostgresAccessToken: jest.fn(async () => ({
    authUserId: 'pu-1',
    profileId: PROFILE_ID,
    email: 'ava@example.com',
  })),
  deletePostgresAccount: jest.fn(),
}));

const PROFILE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CONVERSATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const mockedQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockedQueryRows = queryRows as jest.MockedFunction<typeof queryRows>;

const config = createTestConfig({ nodeEnv: 'development', developmentAuthEnabled: false });

const CONVERSATION = {
  id: CONVERSATION_ID,
  user_id: PROFILE_ID,
  situationship_id: null,
  title: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function message(id: string, isUser: boolean, content: string) {
  return {
    id,
    conversation_id: CONVERSATION_ID,
    content,
    is_user: isUser,
    tokens_used: 0,
    moderation_flagged: false,
    created_at: '2026-01-01T00:00:01Z',
  };
}

function dispatch(method: string, url: string, body?: Record<string, unknown>) {
  const req = createMockRequest({
    method,
    url,
    body,
    headers: { authorization: 'Bearer hinto_at_test' },
  });
  const res = createMockResponse();
  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, createTestContext(), config);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedQueryOne.mockReset();
  mockedQueryRows.mockReset();
  resetRateLimits();
});

describe('AI coach on the RDS path', () => {
  test('lists conversations scoped to the profile', async () => {
    mockedQueryRows.mockResolvedValueOnce([CONVERSATION]);

    const res = await dispatch('GET', '/v1/me/conversations');

    expect(res._getStatusCode()).toBe(200);
    const sql = mockedQueryRows.mock.calls[0][1] as string;
    expect(sql).toContain('FROM ai_conversations');
    expect(mockedQueryRows.mock.calls[0][2]).toEqual([PROFILE_ID, 100]);
  });

  test('creates a conversation', async () => {
    mockedQueryOne.mockResolvedValueOnce(CONVERSATION);

    const res = await dispatch('POST', '/v1/me/conversations', { title: 'Alex' });

    expect(res._getStatusCode()).toBe(201);
    expect(mockedQueryOne.mock.calls[0][1]).toContain('INSERT INTO ai_conversations');
  });

  test('returns 404 for a conversation owned by someone else', async () => {
    mockedQueryOne.mockResolvedValueOnce(null);

    const res = await dispatch('GET', `/v1/me/conversations/${CONVERSATION_ID}`);

    expect(res._getStatusCode()).toBe(404);
    expect(mockedQueryOne.mock.calls[0][2]).toEqual([CONVERSATION_ID, PROFILE_ID]);
  });

  test('sends a message, stores both turns, and increments daily usage', async () => {
    mockedQueryOne
      .mockResolvedValueOnce(CONVERSATION) // ownership check
      .mockResolvedValueOnce({ ai_messages_used: 2 }) // quota
      .mockResolvedValueOnce(message('m1', true, 'Should I text back?')) // user insert
      .mockResolvedValueOnce(message('m2', false, 'AI coach is not configured in this environment.')) // assistant insert
      .mockResolvedValueOnce({ ai_messages_used: 3 }) // usage increment
      .mockResolvedValueOnce({ id: CONVERSATION_ID }); // touch
    mockedQueryRows.mockResolvedValueOnce([message('m0', false, 'Earlier reply'), message('m1', true, 'Should I text back?')]);

    const res = await dispatch('POST', `/v1/me/conversations/${CONVERSATION_ID}/messages`, {
      content: 'Should I text back?',
    });

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as { data: { dailyUsage: { aiMessagesUsed: number }; assistantMessage: { isUser: boolean } } };
    expect(body.data.dailyUsage.aiMessagesUsed).toBe(3);
    expect(body.data.assistantMessage.isUser).toBe(false);

    const inserts = mockedQueryOne.mock.calls.filter((call) => (call[1] as string).includes('INSERT INTO ai_messages'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0][2]).toEqual([CONVERSATION_ID, 'Should I text back?', true, 0, false]);
    expect(inserts[1][2]?.[2]).toBe(false);

    const usage = mockedQueryOne.mock.calls.find((call) => (call[1] as string).includes('INSERT INTO daily_usage'));
    expect(usage?.[2]).toEqual([PROFILE_ID]);
  });

  test('rejects when the daily quota is exhausted', async () => {
    mockedQueryOne
      .mockResolvedValueOnce(CONVERSATION)
      .mockResolvedValueOnce({ ai_messages_used: 30 });

    const res = await dispatch('POST', `/v1/me/conversations/${CONVERSATION_ID}/messages`, {
      content: 'hi',
    });

    expect(res._getStatusCode()).toBe(429);
    expect(mockedQueryOne).toHaveBeenCalledTimes(2);
  });

  test('crisis language returns the emergency response without calling the model', async () => {
    mockedQueryOne
      .mockResolvedValueOnce(CONVERSATION)
      .mockResolvedValueOnce({ ai_messages_used: 0 })
      .mockResolvedValueOnce(message('m1', true, 'I want to kill myself'))
      .mockResolvedValueOnce(message('m2', false, 'safety'))
      .mockResolvedValueOnce({ ai_messages_used: 1 })
      .mockResolvedValueOnce({ id: CONVERSATION_ID });

    const res = await dispatch('POST', `/v1/me/conversations/${CONVERSATION_ID}/messages`, {
      content: 'I want to kill myself',
    });

    expect(res._getStatusCode()).toBe(201);
    const assistantInsert = mockedQueryOne.mock.calls.filter((call) => (call[1] as string).includes('INSERT INTO ai_messages'))[1];
    expect(String(assistantInsert[2]?.[1])).toMatch(/988|crisis|Lifeline/iu);
    expect(mockedQueryRows).not.toHaveBeenCalled();
  });
});
