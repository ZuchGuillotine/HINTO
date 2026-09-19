import { resolveAuthenticatedUser } from '../middleware/auth';
import { createMockRequest, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';
import { createMockSupabaseClient, MockSupabaseClient } from './helpers/supabase';
import { AppError } from '../errors';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const config = createTestConfig();
let mockClient: MockSupabaseClient;

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

beforeEach(() => {
  mockClient = createMockSupabaseClient();
  (getServiceClient as jest.Mock).mockReturnValue(mockClient);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('resolveAuthenticatedUser', () => {
  test('throws 401 when no Authorization header', async () => {
    const req = createMockRequest({ method: 'GET', url: '/v1/me' });
    const ctx = createTestContext();

    await expect(resolveAuthenticatedUser(req, ctx, config)).rejects.toThrow(AppError);

    try {
      await resolveAuthenticatedUser(req, ctx, config);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).statusCode).toBe(401);
      expect((e as AppError).code).toBe('unauthorized');
    }
  });

  test('throws 401 when Authorization header is not Bearer', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Basic abc123' },
    });
    const ctx = createTestContext();

    await expect(resolveAuthenticatedUser(req, ctx, config)).rejects.toThrow(AppError);
  });

  test('throws 401 when Supabase rejects the token', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid JWT' },
    });

    const req = createMockRequest({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer expired-token' },
    });
    const ctx = createTestContext();

    await expect(resolveAuthenticatedUser(req, ctx, config)).rejects.toThrow(AppError);

    try {
      await resolveAuthenticatedUser(req, ctx, config);
    } catch (e) {
      expect((e as AppError).statusCode).toBe(401);
    }
  });

  test('throws 404 when user has no profile', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: TEST_USER_ID,
          email: 'test@example.com',
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '',
        },
      },
      error: null,
    });
    mockClient._mockTable('profiles', { data: null, error: { message: 'not found' } });

    const req = createMockRequest({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    const ctx = createTestContext();

    await expect(resolveAuthenticatedUser(req, ctx, config)).rejects.toThrow(AppError);

    try {
      await resolveAuthenticatedUser(req, ctx, config);
    } catch (e) {
      expect((e as AppError).statusCode).toBe(404);
      expect((e as AppError).code).toBe('profile_not_found');
    }
  });

  test('returns AuthenticatedContext on success', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: TEST_USER_ID,
          email: 'test@example.com',
          aud: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: '',
        },
      },
      error: null,
    });
    mockClient._mockTable('profiles', { data: { id: TEST_USER_ID }, error: null });

    const req = createMockRequest({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    const ctx = createTestContext();

    const result = await resolveAuthenticatedUser(req, ctx, config);

    expect(result.user.authUserId).toBe(TEST_USER_ID);
    expect(result.user.profileId).toBe(TEST_USER_ID);
    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken).toBe('valid-token');
    expect(result.requestId).toBe('test-request-id');
  });
});

describe('development session tokens', () => {
  const PROFILE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  test('are ignored unless API_ENABLE_DEV_AUTH is on', async () => {
    const client = createMockSupabaseClient();
    (getServiceClient as jest.Mock).mockReturnValue(client);
    const req = createMockRequest({
      headers: { authorization: `Bearer dev-session:${PROFILE_ID}` },
    });

    await expect(
      resolveAuthenticatedUser(req, createTestContext(), createTestConfig({ enableDevAuth: false }))
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  test('resolve a profile when explicitly enabled', async () => {
    const client = createMockSupabaseClient();
    (getServiceClient as jest.Mock).mockReturnValue(client);
    client._mockTable('profiles', { data: { id: PROFILE_ID, email: 'dev@x.com' }, error: null });
    const req = createMockRequest({
      headers: { authorization: `Bearer dev-session:${PROFILE_ID}` },
    });

    const ctx = await resolveAuthenticatedUser(
      req,
      createTestContext(),
      createTestConfig({ enableDevAuth: true })
    );
    expect(ctx.user.profileId).toBe(PROFILE_ID);
  });

  test('reject non-uuid ids even when enabled', async () => {
    const client = createMockSupabaseClient();
    (getServiceClient as jest.Mock).mockReturnValue(client);
    const req = createMockRequest({
      headers: { authorization: 'Bearer dev-session:dev-user-001' },
    });

    await expect(
      resolveAuthenticatedUser(req, createTestContext(), createTestConfig({ enableDevAuth: true }))
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
