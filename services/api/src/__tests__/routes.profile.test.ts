import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import { createMockSupabaseClient, mockAuthenticatedUser, MockSupabaseClient } from './helpers/supabase';

// Mock the supabase module so route handlers use our mock client
jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const config = createTestConfig();
let mockClient: MockSupabaseClient;

beforeEach(() => {
  mockClient = createMockSupabaseClient();
  (getServiceClient as jest.Mock).mockReturnValue(mockClient);
});

afterEach(() => {
  jest.clearAllMocks();
});

function dispatchAndWait(
  method: string,
  url: string,
  options: { headers?: Record<string, string>; body?: Record<string, unknown> } = {},
) {
  const req = createMockRequest({ method, url, ...options });
  const res = createMockResponse();
  const ctx = createTestContext();

  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, ctx, config);
  });
}

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const PROFILE_ROW = {
  id: TEST_USER_ID,
  username: 'testuser',
  display_name: 'Test User',
  email: 'test@example.com',
  bio: 'Hello world',
  avatar_url: null,
  privacy: 'public',
  subscription_tier: 'free',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function setupAuthenticatedUser() {
  mockAuthenticatedUser(mockClient, { userId: TEST_USER_ID });
}

describe('GET /v1/me', () => {
  test('returns 401 when no authorization header', async () => {
    const res = await dispatchAndWait('GET', '/v1/me');
    expect(res._getStatusCode()).toBe(401);

    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('unauthorized');
  });

  test('returns 401 when token is invalid', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const res = await dispatchAndWait('GET', '/v1/me', {
      headers: { authorization: 'Bearer bad-token' },
    });
    expect(res._getStatusCode()).toBe(401);
  });

  test('returns 404 when profile not found after auth', async () => {
    // Auth succeeds but profile lookup returns nothing
    mockClient.auth.getUser.mockResolvedValue({
      data: {
        user: { id: TEST_USER_ID, email: 'test@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
      },
      error: null,
    });
    mockClient._mockTable('profiles', { data: null, error: { message: 'not found' } });

    const res = await dispatchAndWait('GET', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res._getStatusCode()).toBe(404);
  });

  test('returns profile aggregate on success', async () => {
    setupAuthenticatedUser();

    // After auth middleware, the handler calls profiles.select(*).eq(id).single()
    // We need the second profiles call (the one in handleGetMe) to return the full row.
    // The first profiles call (in auth middleware) returns { id }.
    // Since our mock returns the same builder for the same table, we need
    // to make the builder return full profile data (auth middleware only uses .id).
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    // Mock auth_identities lookup (enrichment step)
    mockClient._mockTable('auth_identities', { data: [], error: null });

    const res = await dispatchAndWait('GET', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res._getStatusCode()).toBe(200);

    const body = res._getJson() as {
      data: {
        profile: { profileId: string; username: string; privacy: string };
        auth: { authUserId: string; linkedProviders: string[] };
        capabilities: { canEditProfile: boolean };
      };
    };

    expect(body.data.profile.profileId).toBe(TEST_USER_ID);
    expect(body.data.profile.username).toBe('testuser');
    expect(body.data.profile.privacy).toBe('public');
    expect(body.data.auth.authUserId).toBe(TEST_USER_ID);
    expect(body.data.capabilities.canEditProfile).toBe(true);
  });

  test('returns linked providers when auth_identities exist', async () => {
    setupAuthenticatedUser();
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    mockClient._mockTable('auth_identities', {
      data: [
        { provider: 'apple', is_primary: true },
        { provider: 'facebook', is_primary: false },
      ],
      error: null,
    });

    const res = await dispatchAndWait('GET', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as {
      data: { auth: { primaryProvider: string; linkedProviders: string[] } };
    };
    expect(body.data.auth.primaryProvider).toBe('apple');
    expect(body.data.auth.linkedProviders).toEqual(['apple', 'facebook']);
  });
});

describe('PATCH /v1/me', () => {
  test('returns 400 when no valid fields provided', async () => {
    setupAuthenticatedUser();
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('PATCH', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
      body: { unknownField: 'value' },
    });

    expect(res._getStatusCode()).toBe(400);
    const body = res._getJson() as { error: { code: string } };
    expect(body.error.code).toBe('validation_error');
  });

  test('returns 400 for invalid privacy value', async () => {
    setupAuthenticatedUser();
    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });

    const res = await dispatchAndWait('PATCH', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
      body: { privacy: 'invalid_value' },
    });

    expect(res._getStatusCode()).toBe(400);
  });

  test('updates profile successfully', async () => {
    setupAuthenticatedUser();

    const updatedRow = { ...PROFILE_ROW, display_name: 'New Name', bio: 'New bio' };
    mockClient._mockTable('profiles', { data: updatedRow, error: null });

    const res = await dispatchAndWait('PATCH', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
      body: { displayName: 'New Name', bio: 'New bio' },
    });

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { profile: { displayName: string; bio: string } } };
    expect(body.data.profile.displayName).toBe('New Name');
    expect(body.data.profile.bio).toBe('New bio');
  });

  test('accepts valid privacy values', async () => {
    setupAuthenticatedUser();
    mockClient._mockTable('profiles', { data: { ...PROFILE_ROW, privacy: 'mutuals_only' }, error: null });

    const res = await dispatchAndWait('PATCH', '/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
      body: { privacy: 'mutuals_only' },
    });

    expect(res._getStatusCode()).toBe(200);
  });
});
