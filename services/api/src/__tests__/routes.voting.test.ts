import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import { createMockSupabaseClient, mockAuthenticatedUser, MockSupabaseClient } from './helpers/supabase';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const config = createTestConfig();
let mockClient: MockSupabaseClient;

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SESSION_ID = '99999999-9999-9999-9999-999999999999';
const INVITE_CODE = 'ABC123XY';

const SITUATIONSHIP_ROWS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: TEST_USER_ID,
    name: 'Alex',
    emoji: '🔥',
    category: 'dating',
    description: null,
    rank: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    user_id: TEST_USER_ID,
    name: 'Jordan',
    emoji: '💜',
    category: 'talking',
    description: null,
    rank: 1,
    is_active: true,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

const FUTURE_EXPIRES_AT = '2099-01-01T00:00:00.000Z';
const PAST_EXPIRES_AT = '2000-01-01T00:00:00.000Z';

const BASE_SESSION_ROW = {
  id: SESSION_ID,
  owner_id: TEST_USER_ID,
  invite_code: INVITE_CODE,
  title: 'Rate my situationships',
  description: null,
  is_anonymous: true,
  expires_at: FUTURE_EXPIRES_AT,
  is_active: true,
  created_at: '2026-04-01T00:00:00Z',
};

const OWNER_PROFILE_ROW = {
  id: TEST_USER_ID,
  username: 'testuser',
  name: 'Test User',
};

/**
 * Queue a sequence of results for a table. Each await of the builder pops the
 * next result. Useful when a single request hits the same table multiple times
 * with different expected shapes (e.g. voting_sessions: uniqueness check then insert).
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
});

function dispatchAndWait(
  method: string,
  url: string,
  options: { headers?: Record<string, string>; body?: Record<string, unknown>; skipAuth?: boolean } = {},
) {
  const defaultHeaders = options.skipAuth
    ? { ...options.headers }
    : { authorization: 'Bearer valid-token', ...options.headers };
  const req = createMockRequest({ method, url, headers: defaultHeaders, body: options.body });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, config);
  });
}

// ─────────────────────────────────────────────────────────────
// POST /v1/me/voting-sessions
// ─────────────────────────────────────────────────────────────

describe('POST /v1/me/voting-sessions', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait('POST', '/v1/me/voting-sessions', {
      skipAuth: true,
      body: {},
    });
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns 400 when owner has fewer than 2 active situationships', async () => {
    // Auth: profiles returns the user, then situationships lookup returns 1 row.
    mockClient._mockTable('situationships', {
      data: [SITUATIONSHIP_ROWS[0]],
      error: null,
    });

    const res = await dispatchAndWait('POST', '/v1/me/voting-sessions', { body: {} });
    expect(res._getStatusCode()).toBe(400);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  test('returns 201 and session DTO on success', async () => {
    mockClient._mockTable('situationships', {
      data: SITUATIONSHIP_ROWS,
      error: null,
    });

    // voting_sessions table is hit twice in this flow:
    //  (1) uniqueness check — select().eq().limit() → { data: [], error: null }
    //  (2) insert().select().single() → { data: <session row>, error: null }
    queueTableResults(mockClient, 'voting_sessions', [
      { data: [], error: null },
      { data: BASE_SESSION_ROW, error: null },
    ]);

    const res = await dispatchAndWait('POST', '/v1/me/voting-sessions', {
      body: { title: 'My poll', anonymityMode: 'anonymous' },
    });

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as {
      data: {
        session: { votingSessionId: string; inviteCode: string; status: string };
        itemsCount: number;
        publicPath: string;
      };
    };

    expect(body.data.session.votingSessionId).toBe(SESSION_ID);
    // The session DTO's inviteCode echoes whatever the voting_sessions row holds.
    expect(body.data.session.inviteCode).toBe(INVITE_CODE);
    expect(body.data.session.status).toBe('active');
    expect(body.data.itemsCount).toBe(2);
    // publicPath is built from the freshly generated invite code (random), so
    // only assert the path shape, not the exact code.
    expect(body.data.publicPath).toMatch(/^\/v1\/voting-sessions\/[A-Z0-9]+$/);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /v1/me/voting-sessions
// ─────────────────────────────────────────────────────────────

describe('GET /v1/me/voting-sessions', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait('GET', '/v1/me/voting-sessions', { skipAuth: true });
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns list of owner sessions', async () => {
    mockClient._mockTable('voting_sessions', {
      data: [BASE_SESSION_ROW],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me/voting-sessions');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: { sessions: Array<{ votingSessionId: string; inviteCode: string }> };
    };
    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.sessions[0].votingSessionId).toBe(SESSION_ID);
    expect(body.data.sessions[0].inviteCode).toBe(INVITE_CODE);
  });
});

// ─────────────────────────────────────────────────────────────
// POST /v1/me/voting-sessions/:id/expire
// ─────────────────────────────────────────────────────────────

describe('POST /v1/me/voting-sessions/:id/expire', () => {
  test('returns 404 if session not owned', async () => {
    // First lookup returns error; the update path is never reached.
    mockClient._mockTable('voting_sessions', {
      data: null,
      error: { message: 'not found' },
    });

    const res = await dispatchAndWait('POST', `/v1/me/voting-sessions/${SESSION_ID}/expire`);
    expect(res._getStatusCode()).toBe(404);
  });

  test('returns 200 with updated status=closed on success', async () => {
    // voting_sessions is hit twice:
    //  (1) ownership lookup (select/eq/eq/single)
    //  (2) update/eq/eq/select/single → returns the updated row
    queueTableResults(mockClient, 'voting_sessions', [
      { data: BASE_SESSION_ROW, error: null },
      { data: { ...BASE_SESSION_ROW, is_active: false }, error: null },
    ]);

    const res = await dispatchAndWait('POST', `/v1/me/voting-sessions/${SESSION_ID}/expire`);
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as { data: { session: { status: string } } };
    expect(body.data.session.status).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────────
// GET /v1/voting-sessions/:inviteCode (public — no auth required)
// ─────────────────────────────────────────────────────────────

describe('GET /v1/voting-sessions/:inviteCode', () => {
  test('returns 404 for unknown invite', async () => {
    mockClient._mockTable('voting_sessions', {
      data: null,
      error: { message: 'not found' },
    });

    const res = await dispatchAndWait('GET', '/v1/voting-sessions/UNKNOWN1', {
      skipAuth: true,
    });
    expect(res._getStatusCode()).toBe(404);
  });

  test('returns session + items + capabilities (no auth required)', async () => {
    mockClient._mockTable('voting_sessions', { data: BASE_SESSION_ROW, error: null });
    // handler loads the owner profile, which shares the profiles builder; the
    // test fixture here doesn't need the auth-middleware profile since the
    // route is public.
    mockClient._mockTable('profiles', { data: OWNER_PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });

    const res = await dispatchAndWait('GET', `/v1/voting-sessions/${INVITE_CODE}`, {
      skipAuth: true,
    });
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: {
        session: { inviteCode: string; status: string };
        ownerProfile: { profileId: string; displayName: string };
        items: Array<{ situationshipId: string; name: string }>;
        capabilities: { canVote: boolean; canComment: boolean };
        viewerContext: { mode: string };
      };
    };

    expect(body.data.session.inviteCode).toBe(INVITE_CODE);
    expect(body.data.session.status).toBe('active');
    expect(body.data.ownerProfile.profileId).toBe(TEST_USER_ID);
    expect(body.data.ownerProfile.displayName).toBe('Test User');
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0].name).toBe('Alex');
    expect(body.data.capabilities.canVote).toBe(true);
    expect(body.data.capabilities.canComment).toBe(true);
    expect(body.data.viewerContext.mode).toBe('public_session_viewer');
  });
});

// ─────────────────────────────────────────────────────────────
// POST /v1/voting-sessions/:inviteCode/votes
// ─────────────────────────────────────────────────────────────

describe('POST /v1/voting-sessions/:inviteCode/votes', () => {
  const VOTER_IDENTITY = 'voter-identity-abc-123';

  test('rejects when session is closed (is_active=false)', async () => {
    mockClient._mockTable('voting_sessions', {
      data: { ...BASE_SESSION_ROW, is_active: false },
      error: null,
    });

    const res = await dispatchAndWait('POST', `/v1/voting-sessions/${INVITE_CODE}/votes`, {
      skipAuth: true,
      body: {
        voterIdentity: VOTER_IDENTITY,
        bestSituationshipId: SITUATIONSHIP_ROWS[0].id,
        worstSituationshipId: SITUATIONSHIP_ROWS[1].id,
      },
    });

    expect(res._getStatusCode()).toBe(410);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('session_closed');
  });

  test('rejects when session has expired', async () => {
    mockClient._mockTable('voting_sessions', {
      data: { ...BASE_SESSION_ROW, expires_at: PAST_EXPIRES_AT },
      error: null,
    });

    const res = await dispatchAndWait('POST', `/v1/voting-sessions/${INVITE_CODE}/votes`, {
      skipAuth: true,
      body: {
        voterIdentity: VOTER_IDENTITY,
        bestSituationshipId: SITUATIONSHIP_ROWS[0].id,
        worstSituationshipId: SITUATIONSHIP_ROWS[1].id,
      },
    });

    expect(res._getStatusCode()).toBe(410);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('session_expired');
  });

  test('rejects duplicate bestSituationshipId === worstSituationshipId', async () => {
    mockClient._mockTable('voting_sessions', { data: BASE_SESSION_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });

    const res = await dispatchAndWait('POST', `/v1/voting-sessions/${INVITE_CODE}/votes`, {
      skipAuth: true,
      body: {
        voterIdentity: VOTER_IDENTITY,
        bestSituationshipId: SITUATIONSHIP_ROWS[0].id,
        worstSituationshipId: SITUATIONSHIP_ROWS[0].id,
      },
    });

    expect(res._getStatusCode()).toBe(400);
    const body = res._getJson() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toMatch(/different/);
  });

  test('rejects when voter_identity already voted (409 duplicate_vote)', async () => {
    mockClient._mockTable('voting_sessions', { data: BASE_SESSION_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });
    // votes select returns an existing vote → handler throws duplicate_vote before insert.
    mockClient._mockTable('votes', {
      data: [{ id: 'existing-vote-id' }],
      error: null,
    });

    const res = await dispatchAndWait('POST', `/v1/voting-sessions/${INVITE_CODE}/votes`, {
      skipAuth: true,
      body: {
        voterIdentity: VOTER_IDENTITY,
        bestSituationshipId: SITUATIONSHIP_ROWS[0].id,
        worstSituationshipId: SITUATIONSHIP_ROWS[1].id,
      },
    });

    expect(res._getStatusCode()).toBe(409);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('duplicate_vote');
  });

  test('returns 201 on successful vote submission', async () => {
    mockClient._mockTable('voting_sessions', { data: BASE_SESSION_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });
    // votes table is hit twice: (1) existing-check returns [], (2) insert returns the rows.
    queueTableResults(mockClient, 'votes', [
      { data: [], error: null },
      {
        data: [
          {
            id: 'vote-1',
            situationship_id: SITUATIONSHIP_ROWS[0].id,
            vote_type: 'best_fit',
            created_at: '2026-04-17T00:00:00Z',
          },
          {
            id: 'vote-2',
            situationship_id: SITUATIONSHIP_ROWS[1].id,
            vote_type: 'not_the_one',
            created_at: '2026-04-17T00:00:00Z',
          },
        ],
        error: null,
      },
    ]);

    const res = await dispatchAndWait('POST', `/v1/voting-sessions/${INVITE_CODE}/votes`, {
      skipAuth: true,
      body: {
        voterIdentity: VOTER_IDENTITY,
        voterName: 'Friend',
        comment: 'love it',
        bestSituationshipId: SITUATIONSHIP_ROWS[0].id,
        worstSituationshipId: SITUATIONSHIP_ROWS[1].id,
      },
    });

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as {
      data: {
        accepted: boolean;
        votesRecorded: number;
        votingSessionId: string;
        selections: { bestSituationshipId: string; worstSituationshipId: string };
      };
    };
    expect(body.data.accepted).toBe(true);
    expect(body.data.votesRecorded).toBe(2);
    expect(body.data.votingSessionId).toBe(SESSION_ID);
    expect(body.data.selections.bestSituationshipId).toBe(SITUATIONSHIP_ROWS[0].id);
    expect(body.data.selections.worstSituationshipId).toBe(SITUATIONSHIP_ROWS[1].id);
  });
});

// ─────────────────────────────────────────────────────────────
// GET /v1/me/voting-sessions/:id/results
// ─────────────────────────────────────────────────────────────

describe('GET /v1/me/voting-sessions/:id/results', () => {
  test('returns 401 without auth', async () => {
    const res = await dispatchAndWait('GET', `/v1/me/voting-sessions/${SESSION_ID}/results`, {
      skipAuth: true,
    });
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns ranked results + comments for the owner', async () => {
    mockClient._mockTable('voting_sessions', { data: BASE_SESSION_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });
    mockClient._mockTable('votes', {
      data: [
        {
          id: 'v1',
          voting_session_id: SESSION_ID,
          situationship_id: SITUATIONSHIP_ROWS[0].id,
          voter_id: null,
          voter_identity: 'voter-one-identity',
          voter_name: 'Friend A',
          vote_type: 'best_fit',
          comment: 'great vibes',
          created_at: '2026-04-17T00:00:00Z',
        },
        {
          id: 'v2',
          voting_session_id: SESSION_ID,
          situationship_id: SITUATIONSHIP_ROWS[1].id,
          voter_id: null,
          voter_identity: 'voter-one-identity',
          voter_name: 'Friend A',
          vote_type: 'not_the_one',
          comment: null,
          created_at: '2026-04-17T00:00:00Z',
        },
      ],
      error: null,
    });

    const res = await dispatchAndWait('GET', `/v1/me/voting-sessions/${SESSION_ID}/results`);
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: {
        session: { votingSessionId: string };
        totalVotes: number;
        totalVoters: number;
        results: Array<{ situationshipId: string; bestVotes: number; worstVotes: number; rank: number }>;
        comments: Array<{ comment: string; voterLabel: string | null }>;
      };
    };

    expect(body.data.session.votingSessionId).toBe(SESSION_ID);
    expect(body.data.totalVotes).toBe(2);
    expect(body.data.totalVoters).toBe(1);
    expect(body.data.results).toHaveLength(2);

    const alexResult = body.data.results.find((r) => r.situationshipId === SITUATIONSHIP_ROWS[0].id);
    const jordanResult = body.data.results.find((r) => r.situationshipId === SITUATIONSHIP_ROWS[1].id);
    expect(alexResult?.bestVotes).toBe(1);
    expect(alexResult?.worstVotes).toBe(0);
    expect(alexResult?.rank).toBe(1);
    expect(jordanResult?.worstVotes).toBe(1);
    expect(jordanResult?.rank).toBe(2);

    expect(body.data.comments).toHaveLength(1);
    expect(body.data.comments[0].comment).toBe('great vibes');
    // Session is anonymous, so voterLabel is stripped.
    expect(body.data.comments[0].voterLabel).toBeNull();
  });
});
