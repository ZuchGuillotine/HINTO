import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from '../__tests__/helpers/http';
import { createTestConfig } from '../__tests__/helpers/config';
import { createMockSupabaseClient, MockSupabaseClient } from '../__tests__/helpers/supabase';

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
  username: 'alex',
  display_name: 'Alex',
  email: 'alex@example.com',
  bio: null,
  avatar_url: null,
  privacy: 'private',
  subscription_tier: 'free',
  age: null,
  age_verified: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('POST /v1/auth/email/otp', () => {
  test('normalizes email and sends a Supabase OTP', async () => {
    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: '  Alex@Example.com ' },
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
    });
    expect(res._getJson()).toMatchObject({
      data: { sent: true, email: 'alex@example.com' },
    });
  });

  test('rejects invalid email before calling Supabase', async () => {
    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: 'not-an-email' },
    });

    expect(res._getStatusCode()).toBe(400);
    expect(mockClient.auth.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('POST /v1/auth/email/verify', () => {
  test('verifies OTP, links email identity, and returns an app session', async () => {
    mockClient.auth.verifyOtp.mockResolvedValue({
      data: {
        user: { id: TEST_USER_ID, email: 'alex@example.com' },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_at: 1770000000,
        },
      },
      error: null,
    });

    mockClient._mockTable('profiles', { data: PROFILE_ROW, error: null });
    const identities = mockClient._mockTableSequence('auth_identities', [
      { data: [], error: null },
      { data: null, error: null },
      { data: [{ provider: 'email', is_primary: true }], error: null },
    ]);

    const res = await dispatchAndWait('POST', '/v1/auth/email/verify', {
      body: { email: 'Alex@Example.com', token: '123456' },
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      token: '123456',
      type: 'email',
    });
    expect(identities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER_ID,
        provider: 'email',
        provider_user_id: TEST_USER_ID,
        provider_email: 'alex@example.com',
        is_primary: true,
      }),
      { onConflict: 'user_id,provider' },
    );

    expect(res._getJson()).toMatchObject({
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: 1770000000,
        me: {
          auth: {
            primaryProvider: 'email',
            linkedProviders: ['email'],
          },
        },
      },
    });
  });

  test('returns 401 for invalid or expired OTP', async () => {
    mockClient.auth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' },
    });

    const res = await dispatchAndWait('POST', '/v1/auth/email/verify', {
      body: { email: 'alex@example.com', token: '000000' },
    });

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJson()).toMatchObject({
      error: { code: 'verification_failed' },
    });
  });
});
