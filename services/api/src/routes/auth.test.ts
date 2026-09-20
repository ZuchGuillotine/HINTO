import { routeRequest } from '../routes';
import { createMockRequest, createMockResponse, createTestContext } from '../__tests__/helpers/http';
import { createTestConfig } from '../__tests__/helpers/config';
import { createMockSupabaseClient, MockSupabaseClient } from '../__tests__/helpers/supabase';

jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));

import { getServiceClient } from '../supabase';

const defaultConfig = createTestConfig();
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
  options: {
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    config?: ReturnType<typeof createTestConfig>;
  } = {},
) {
  const req = createMockRequest({ method, url, ...options });
  const res = createMockResponse();
  const ctx = createTestContext();
  const config = options.config ?? defaultConfig;

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
  test('uses real OTP delivery by default when no local bypass is configured', async () => {
    mockClient._mockTable('profiles', { data: { id: TEST_USER_ID }, error: null });

    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: '  Alex@Example.com ' },
      config: createTestConfig({
        developmentAuthEnabled: false,
        emailOtpDeliveryDisabled: false,
      }),
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: expect.objectContaining({
        shouldCreateUser: false,
      }),
    });
    expect(res._getJson()).toMatchObject({
      data: { sent: true, email: 'alex@example.com' },
    });
  });

  test('normalizes email and skips Supabase email delivery when disabled for local testing', async () => {
    mockClient._mockTable('profiles', { data: { id: TEST_USER_ID }, error: null });

    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: '  Alex@Example.com ' },
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(res._getJson()).toMatchObject({
      data: {
        sent: true,
        email: 'alex@example.com',
        deliveryDisabled: true,
        developmentCode: 'any',
      },
    });
  });

  test('rejects disabled email delivery unless development auth is explicitly enabled', async () => {
    mockClient._mockTable('profiles', { data: { id: TEST_USER_ID }, error: null });

    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: 'alex@example.com' },
      config: createTestConfig({
        developmentAuthEnabled: false,
        emailOtpDeliveryDisabled: true,
      }),
    });

    expect(res._getStatusCode()).toBe(403);
    expect(mockClient.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(res._getJson()).toMatchObject({
      error: { code: 'development_auth_disabled' },
    });
  });

  test('sends a Supabase OTP when email delivery is enabled', async () => {
    mockClient._mockTable('profiles', { data: { id: TEST_USER_ID }, error: null });

    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: { email: '  Alex@Example.com ' },
      config: createTestConfig({ emailOtpDeliveryDisabled: false }),
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'alex@example.com',
      options: expect.objectContaining({
        shouldCreateUser: false,
      }),
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

  test('allows sign up OTP only when username and displayName are supplied for a new email', async () => {
    mockClient._mockTable('profiles', { data: null, error: null });

    const res = await dispatchAndWait('POST', '/v1/auth/email/otp', {
      body: {
        email: 'new@example.com',
        intent: 'sign_up',
        username: 'new_user',
        displayName: 'New User',
      },
      config: createTestConfig({ emailOtpDeliveryDisabled: false }),
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'new@example.com',
      options: expect.objectContaining({
        shouldCreateUser: true,
        data: expect.objectContaining({
          username: 'new_user',
          display_name: 'New User',
        }),
      }),
    });
  });
});

describe('POST /v1/auth/email/verify', () => {
  test('creates a local email test session when email delivery is disabled', async () => {
    mockClient._mockTableSequence('profiles', [
      { data: { id: TEST_USER_ID }, error: null },
      { data: PROFILE_ROW, error: null },
    ]);
    const identities = mockClient._mockTableSequence('auth_identities', [
      { data: [], error: null },
      { data: null, error: null },
      { data: [{ provider: 'email', is_primary: true }], error: null },
    ]);

    const res = await dispatchAndWait('POST', '/v1/auth/email/verify', {
      body: { email: 'Alex@Example.com', token: 'anything' },
    });

    expect(res._getStatusCode()).toBe(200);
    expect(mockClient.auth.verifyOtp).not.toHaveBeenCalled();
    expect(mockClient.auth.admin.createUser).not.toHaveBeenCalled();
    expect(identities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER_ID,
        provider: 'email',
        provider_email: 'alex@example.com',
      }),
      { onConflict: 'user_id,provider' },
    );
    expect(res._getJson()).toMatchObject({
      data: {
        accessToken: `dev-session:${TEST_USER_ID}`,
        refreshToken: `dev-refresh:${TEST_USER_ID}`,
        developmentBypass: true,
        me: {
          auth: {
            primaryProvider: 'email',
            linkedProviders: ['email'],
          },
        },
      },
    });
  });

  test('rejects local email session creation unless development auth is explicitly enabled', async () => {
    const res = await dispatchAndWait('POST', '/v1/auth/email/verify', {
      body: { email: 'Alex@Example.com', token: 'anything' },
      config: createTestConfig({
        developmentAuthEnabled: false,
        emailOtpDeliveryDisabled: true,
      }),
    });

    expect(res._getStatusCode()).toBe(403);
    expect(mockClient.auth.verifyOtp).not.toHaveBeenCalled();
    expect(mockClient.auth.admin.createUser).not.toHaveBeenCalled();
    expect(res._getJson()).toMatchObject({
      error: { code: 'development_auth_disabled' },
    });
  });

  test('verifies OTP, links email identity, and returns an app session when delivery is enabled', async () => {
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
      config: createTestConfig({ emailOtpDeliveryDisabled: false }),
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
      config: createTestConfig({ emailOtpDeliveryDisabled: false }),
    });

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJson()).toMatchObject({
      error: { code: 'verification_failed' },
    });
  });
});
