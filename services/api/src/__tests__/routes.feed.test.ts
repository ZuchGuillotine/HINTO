import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import { createMockSupabaseClient, MockSupabaseClient } from './helpers/supabase';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const FRIEND_ID = '22222222-2222-4222-8222-222222222222';

let mockClient: MockSupabaseClient;

beforeEach(() => {
  mockClient = createMockSupabaseClient();
  (getServiceClient as jest.Mock).mockReturnValue(mockClient);
  mockClient.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: VIEWER_ID,
        email: 'viewer@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
      },
    },
    error: null,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

function dispatchAndWait() {
  const req = createMockRequest({
    method: 'GET',
    url: '/v1/me/feed',
    headers: { authorization: 'Bearer valid-token' },
  });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, createTestConfig());
  });
}

describe('GET /v1/me/feed', () => {
  test('returns accepted friends active situationships', async () => {
    mockClient._mockTableSequence('profiles', [
      { data: { id: VIEWER_ID }, error: null },
      {
        data: [
          {
            id: FRIEND_ID,
            username: 'mira',
            name: 'Mira',
            avatar_url: 'https://example.com/mira.png',
          },
        ],
        error: null,
      },
    ]);
    mockClient._mockTableSequence('friendships', [
      {
        data: [
          {
            requester_id: VIEWER_ID,
            addressee_id: FRIEND_ID,
            responded_at: '2026-01-02T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ]);
    mockClient._mockTable('situationships', {
      data: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          user_id: FRIEND_ID,
          name: 'Coffee date',
          emoji: '☕️',
          category: 'Crush',
          description: 'Met through friends',
          rank: 1,
          is_active: true,
          created_at: '2026-01-03T00:00:00Z',
          updated_at: '2026-01-04T00:00:00Z',
          primary_image_id: null,
          image_count: 0,
          has_images: false,
        },
      ],
      error: null,
    });

    const res = await dispatchAndWait();

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJson()).toMatchObject({
      data: {
        viewerProfileId: VIEWER_ID,
        items: [
          {
            ownerProfile: {
              profileId: FRIEND_ID,
              username: 'mira',
              displayName: 'Mira',
            },
            viewerContext: {
              mode: 'authorized_viewer',
              viewerProfileId: VIEWER_ID,
            },
            situationship: {
              situationshipId: '33333333-3333-4333-8333-333333333333',
              ownerProfileId: FRIEND_ID,
              name: 'Coffee date',
            },
          },
        ],
      },
    });
  });

  test('returns an empty feed when the viewer has no accepted friendships', async () => {
    mockClient._mockTable('profiles', { data: { id: VIEWER_ID }, error: null });
    mockClient._mockTableSequence('friendships', [
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const res = await dispatchAndWait();

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJson()).toMatchObject({
      data: {
        viewerProfileId: VIEWER_ID,
        items: [],
      },
    });
    expect(mockClient.from).not.toHaveBeenCalledWith('situationships');
  });
});
