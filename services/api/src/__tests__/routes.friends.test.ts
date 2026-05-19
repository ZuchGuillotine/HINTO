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
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const config = createTestConfig();
let mockClient: MockSupabaseClient;

const VIEWER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FRIEND_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const REQUEST_ID = '11111111-2222-3333-4444-555555555555';
const SUGGESTION_ID = '99999999-8888-7777-6666-555555555555';

beforeEach(() => {
  mockClient = createMockSupabaseClient();
  (getServiceClient as jest.Mock).mockReturnValue(mockClient);
  mockAuthenticatedUser(mockClient, { userId: VIEWER_ID });
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

describe('friends routes', () => {
  test('GET /v1/me/friends partitions accepted and pending relationships', async () => {
    mockClient._mockTableSequence('profiles', [
      { data: { id: VIEWER_ID, email: 'viewer@example.com' }, error: null },
      {
        data: [
          {
            id: FRIEND_ID,
            username: 'maya',
            name: 'Maya',
            display_name: null,
            avatar_url: null,
          },
        ],
        error: null,
      },
    ]);
    mockClient._mockTable('friendships', {
      data: [
        {
          id: REQUEST_ID,
          requester_id: VIEWER_ID,
          addressee_id: FRIEND_ID,
          status: 'accepted',
          requested_at: '2026-05-01T00:00:00Z',
          responded_at: '2026-05-01T00:01:00Z',
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:01:00Z',
        },
      ],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me/friends');
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as {
      data: { friends: Array<{ otherProfile: { profileId: string; displayName: string } }> };
    };
    expect(body.data.friends).toHaveLength(1);
    expect(body.data.friends[0].otherProfile.profileId).toBe(FRIEND_ID);
    expect(body.data.friends[0].otherProfile.displayName).toBe('Maya');
  });

  test('POST /v1/me/friend-requests creates a username-targeted request', async () => {
    mockClient._mockTableSequence('profiles', [
      { data: { id: VIEWER_ID, email: 'viewer@example.com' }, error: null },
      { data: { id: FRIEND_ID }, error: null },
    ]);
    mockClient._mockTable('friendships', {
      data: {
        id: REQUEST_ID,
        requester_id: VIEWER_ID,
        addressee_id: FRIEND_ID,
        status: 'pending',
      },
      error: null,
    });

    const res = await dispatchAndWait('POST', '/v1/me/friend-requests', {
      body: { username: '@maya' },
    });
    expect(res._getStatusCode()).toBe(201);
    const body = res._getJson() as { data: { friendship: { status: string } } };
    expect(body.data.friendship.status).toBe('pending');
  });

  test('POST /v1/me/friend-requests/:id/accept accepts incoming request', async () => {
    mockClient._mockTable('friendships', {
      data: {
        id: REQUEST_ID,
        requester_id: FRIEND_ID,
        addressee_id: VIEWER_ID,
        status: 'accepted',
      },
      error: null,
    });

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/friend-requests/${REQUEST_ID}/accept`,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { friendship: { status: string } } };
    expect(body.data.friendship.status).toBe('accepted');
  });
});

describe('friend suggestions routes', () => {
  test('GET /v1/me/friend-suggestions returns conservative suggestion cards', async () => {
    mockClient._mockTable('friend_suggestions', {
      data: [
        {
          id: SUGGESTION_ID,
          suggested_profile_id: FRIEND_ID,
          source: 'mutual_friend',
          reason_code: 'mutual_friend',
          score: 60,
          created_at: '2026-05-01T00:00:00Z',
          expires_at: '2026-06-01T00:00:00Z',
          suggested_profile: {
            id: FRIEND_ID,
            username: 'maya',
            name: 'Maya',
            display_name: null,
            avatar_url: null,
          },
        },
      ],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me/friend-suggestions');
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as {
      data: { suggestions: Array<{ suggestionId: string; profile: { displayName: string } }> };
    };
    expect(body.data.suggestions[0].suggestionId).toBe(SUGGESTION_ID);
    expect(body.data.suggestions[0].profile.displayName).toBe('Maya');
  });

  test('POST /v1/me/friend-suggestions/:id/dismiss dismisses a suggestion', async () => {
    mockClient._mockTable('friend_suggestions', {
      data: [{ id: SUGGESTION_ID }],
      error: null,
    });

    const res = await dispatchAndWait(
      'POST',
      `/v1/me/friend-suggestions/${SUGGESTION_ID}/dismiss`,
    );
    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { suggestionId: string; dismissed: boolean } };
    expect(body.data.suggestionId).toBe(SUGGESTION_ID);
    expect(body.data.dismissed).toBe(true);
  });
});
