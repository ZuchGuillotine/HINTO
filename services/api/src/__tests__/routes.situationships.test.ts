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

const SITUATIONSHIP_ROWS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: TEST_USER_ID,
    name: 'Alex',
    emoji: '🔥',
    category: 'dating',
    description: 'Met at coffee shop',
    rank: 0,
    status: 'active',
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
    status: 'active',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

const PROFILE_ROW = {
  id: TEST_USER_ID,
  username: 'testuser',
  display_name: 'Test User',
};

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
  options: { headers?: Record<string, string>; body?: Record<string, unknown> } = {},
) {
  const defaultHeaders = { authorization: 'Bearer valid-token', ...options.headers };
  const req = createMockRequest({ method, url, headers: defaultHeaders, body: options.body });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, config);
  });
}

describe('GET /v1/me/situationships', () => {
  test('returns 401 without auth', async () => {
    const req = createMockRequest({ method: 'GET', url: '/v1/me/situationships' });
    const res = createMockResponse();
    const ctx = createTestContext();

    await new Promise<void>((resolve) => {
      res.on('finish', () => resolve());
      routeRequest(req, res, ctx, config);
    });

    expect(res._getStatusCode()).toBe(401);
  });

  test('returns situationship list on success', async () => {
    // Auth middleware calls profiles, then handler calls situationships then profiles again
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: SITUATIONSHIP_ROWS, error: null });

    const res = await dispatchAndWait('GET', '/v1/me/situationships');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: {
        items: Array<{ situationshipId: string; name: string; rank: number }>;
        viewerContext: { mode: string };
        capabilities: { canEdit: boolean; canVote: boolean };
      };
    };

    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0].name).toBe('Alex');
    expect(body.data.items[0].rank).toBe(0);
    expect(body.data.items[1].name).toBe('Jordan');
    expect(body.data.viewerContext.mode).toBe('owner');
    expect(body.data.capabilities.canEdit).toBe(true);
    expect(body.data.capabilities.canVote).toBe(false);
  });

  test('returns empty list when user has no situationships', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: [], error: null });

    const res = await dispatchAndWait('GET', '/v1/me/situationships');
    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(0);
  });
});

describe('POST /v1/me/situationships', () => {
  test('returns 400 when name is missing', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('POST', '/v1/me/situationships', {
      body: { emoji: '🔥' },
    });

    expect(res._getStatusCode()).toBe(400);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  test('returns 400 when name is empty string', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('POST', '/v1/me/situationships', {
      body: { name: '   ' },
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('creates situationship successfully', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const newRow = {
      ...SITUATIONSHIP_ROWS[0],
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Sam',
      rank: 2,
    };
    mockClient._mockTable('situationships', { data: newRow, error: null });

    const res = await dispatchAndWait('POST', '/v1/me/situationships', {
      body: { name: 'Sam', emoji: '🔥', category: 'dating', description: 'From the gym' },
    });

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as { data: { situationship: { name: string; situationshipId: string } } };
    expect(body.data.situationship.name).toBe('Sam');
    expect(body.data.situationship.situationshipId).toBe('33333333-3333-3333-3333-333333333333');
  });
});

describe('PATCH /v1/me/situationships/:id', () => {
  test('returns 400 when no valid fields', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait(
      'PATCH',
      `/v1/me/situationships/${SITUATIONSHIP_ROWS[0].id}`,
      { body: { unknownField: 'x' } },
    );

    expect(res._getStatusCode()).toBe(400);
  });

  test('returns 400 for invalid status value', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait(
      'PATCH',
      `/v1/me/situationships/${SITUATIONSHIP_ROWS[0].id}`,
      { body: { status: 'deleted' } },
    );

    expect(res._getStatusCode()).toBe(400);
  });

  test('returns 404 when situationship not owned by user', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: null, error: { message: 'not found' } });

    const res = await dispatchAndWait(
      'PATCH',
      `/v1/me/situationships/${SITUATIONSHIP_ROWS[0].id}`,
      { body: { name: 'Updated' } },
    );

    expect(res._getStatusCode()).toBe(404);
  });

  test('updates situationship successfully', async () => {
    const updatedRow = { ...SITUATIONSHIP_ROWS[0], name: 'Updated Alex' };
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: updatedRow, error: null });

    const res = await dispatchAndWait(
      'PATCH',
      `/v1/me/situationships/${SITUATIONSHIP_ROWS[0].id}`,
      { body: { name: 'Updated Alex' } },
    );

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { situationship: { name: string } } };
    expect(body.data.situationship.name).toBe('Updated Alex');
  });
});

describe('DELETE /v1/me/situationships/:id', () => {
  test('deletes situationship successfully', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', { data: null, error: null });

    const res = await dispatchAndWait(
      'DELETE',
      `/v1/me/situationships/${SITUATIONSHIP_ROWS[0].id}`,
    );

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { deleted: boolean; situationshipId: string } };
    expect(body.data.deleted).toBe(true);
    expect(body.data.situationshipId).toBe(SITUATIONSHIP_ROWS[0].id);
  });

  test('rejects non-uuid path parameters', async () => {
    const res = await dispatchAndWait('DELETE', '/v1/me/situationships/not-a-uuid');
    expect(res._getStatusCode()).toBe(404);
  });
});

describe('PUT /v1/me/situationships/order', () => {
  test('returns 400 when orderedSituationshipIds is missing', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('PUT', '/v1/me/situationships/order', {
      body: {},
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('returns 400 when orderedSituationshipIds is empty', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('PUT', '/v1/me/situationships/order', {
      body: { orderedSituationshipIds: [] },
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('returns 400 for mismatched ID count', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', {
      data: SITUATIONSHIP_ROWS.map((r) => ({ id: r.id, user_id: r.user_id, rank: r.rank, status: r.status })),
      error: null,
    });

    const res = await dispatchAndWait('PUT', '/v1/me/situationships/order', {
      body: { orderedSituationshipIds: [SITUATIONSHIP_ROWS[0].id] },
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('returns 400 for duplicate IDs', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('situationships', {
      data: SITUATIONSHIP_ROWS.map((r) => ({ id: r.id, user_id: r.user_id, rank: r.rank, status: r.status })),
      error: null,
    });

    const res = await dispatchAndWait('PUT', '/v1/me/situationships/order', {
      body: {
        orderedSituationshipIds: [SITUATIONSHIP_ROWS[0].id, SITUATIONSHIP_ROWS[0].id],
      },
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('reorders successfully', async () => {
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    // The handler reads situationships twice: once for validation, once for the updated list
    const reversedRows = [...SITUATIONSHIP_ROWS].reverse().map((r, i) => ({ ...r, rank: i }));
    mockClient._mockTable('situationships', {
      data: SITUATIONSHIP_ROWS.map((r) => ({ id: r.id, user_id: r.user_id, rank: r.rank, status: r.status })),
      error: null,
    });

    const res = await dispatchAndWait('PUT', '/v1/me/situationships/order', {
      body: {
        orderedSituationshipIds: [SITUATIONSHIP_ROWS[1].id, SITUATIONSHIP_ROWS[0].id],
      },
    });

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { ordering: { orderedSituationshipIds: string[] } } };
    expect(body.data.ordering).toBeDefined();
  });
});
