import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import {
  createMockSupabaseClient,
  mockAuthenticatedUser,
  MockSupabaseClient,
} from './helpers/supabase';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getAuthClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const config = createTestConfig();
let mockClient: MockSupabaseClient;

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OTHER_USER_ID = '11111111-2222-3333-4444-555555555555';

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
  options: { headers?: Record<string, string>; body?: Record<string, unknown> } = {}
) {
  const req = createMockRequest({
    method,
    url,
    ...options,
    headers: { authorization: 'Bearer valid-token', ...(options.headers ?? {}) },
  });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>(resolve => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, config);
  });
}

describe('POST /v1/reports', () => {
  test('rejects unknown content types', async () => {
    const res = await dispatchAndWait('POST', '/v1/reports', {
      body: { contentType: 'meme', contentId: OTHER_USER_ID, reason: 'spam' },
    });
    expect(res._getStatusCode()).toBe(400);
  });

  test('rejects non-uuid content ids', async () => {
    const res = await dispatchAndWait('POST', '/v1/reports', {
      body: { contentType: 'profile', contentId: 'nope', reason: 'spam' },
    });
    expect(res._getStatusCode()).toBe(400);
  });

  test('creates a pending report', async () => {
    mockClient._mockTable('reports', {
      data: {
        id: '99999999-9999-9999-9999-999999999999',
        content_type: 'profile',
        content_id: OTHER_USER_ID,
        reason: 'harassment',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    const res = await dispatchAndWait('POST', '/v1/reports', {
      body: {
        contentType: 'profile',
        contentId: OTHER_USER_ID,
        reportedProfileId: OTHER_USER_ID,
        reason: 'harassment',
        description: 'Sent me threats',
      },
    });

    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as { data: { report: { status: string; reason: string } } };
    expect(body.data.report.status).toBe('pending');
    expect(body.data.report.reason).toBe('harassment');

    const insert = mockClient._getBuilder('reports').insert;
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_id: TEST_USER_ID, reported_user_id: OTHER_USER_ID })
    );
  });
});

describe('/v1/me/blocks', () => {
  test('lists blocks', async () => {
    mockClient._mockTable('blocks', {
      data: [{ blocked_id: OTHER_USER_ID, reason: null, created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me/blocks');
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { blocks: { blockedProfileId: string }[] } };
    expect(body.data.blocks[0].blockedProfileId).toBe(OTHER_USER_ID);
  });

  test('refuses to block yourself', async () => {
    const res = await dispatchAndWait('POST', '/v1/me/blocks', {
      body: { blockedProfileId: TEST_USER_ID },
    });
    expect(res._getStatusCode()).toBe(400);
  });

  test('creates a block', async () => {
    mockClient._mockTable('blocks', {
      data: { blocked_id: OTHER_USER_ID, reason: 'creepy', created_at: '2026-01-01T00:00:00Z' },
      error: null,
    });

    const res = await dispatchAndWait('POST', '/v1/me/blocks', {
      body: { blockedProfileId: OTHER_USER_ID, reason: 'creepy' },
    });
    expect(res._getStatusCode()).toBe(201);
    expect(mockClient._getBuilder('blocks').upsert).toHaveBeenCalled();
  });

  test('removes a block', async () => {
    mockClient._mockTable('blocks', { data: [{ blocked_id: OTHER_USER_ID }], error: null });

    const res = await dispatchAndWait('DELETE', `/v1/me/blocks/${OTHER_USER_ID}`);
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { removed: boolean } };
    expect(body.data.removed).toBe(true);
  });
});

describe('DELETE /v1/me', () => {
  test('deletes the auth user and returns the profile id', async () => {
    const res = await dispatchAndWait('DELETE', '/v1/me');
    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.admin.deleteUser).toHaveBeenCalledWith(TEST_USER_ID);
    const body = res._getJson() as { data: { deleted: boolean; profileId: string } };
    expect(body.data.deleted).toBe(true);
    expect(body.data.profileId).toBe(TEST_USER_ID);
  });

  test('requires a valid token', async () => {
    mockClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = await dispatchAndWait('DELETE', '/v1/me', {
      headers: { authorization: 'Bearer expired' },
    });
    expect(res._getStatusCode()).toBe(401);
  });
});
