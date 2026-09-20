import { routeRequest } from '../routes';
import { queryOne, withTransaction } from '../db';
import { setEmailSender } from '../email';
import { resetRateLimits } from '../rate-limit';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';

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

const mockedQueryOne = queryOne as jest.MockedFunction<typeof queryOne>;
const mockedWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

const PROFILE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PLATFORM_USER_ID = 'pppppppp-pppp-4ppp-8ppp-pppppppppppp';

const sent: { to: string; subject: string; text: string }[] = [];

function makeConfig(overrides = {}) {
  return createTestConfig({
    nodeEnv: 'development',
    developmentAuthEnabled: false,
    emailOtpDeliveryDisabled: false,
    sesFromEmail: 'no-reply@hnnt.app',
    ...overrides,
  });
}

function dispatch(config: ReturnType<typeof createTestConfig>, url: string, body: Record<string, unknown>) {
  const req = createMockRequest({ method: 'POST', url, body });
  const res = createMockResponse();
  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, createTestContext(), config);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Drop queued mockResolvedValueOnce values from earlier tests too.
  mockedQueryOne.mockReset();
  (jest.requireMock('../db').queryRows as jest.Mock).mockReset().mockResolvedValue([]);
  resetRateLimits();
  sent.length = 0;
  setEmailSender(async (_config, message) => {
    sent.push({ to: message.to, subject: message.subject, text: message.text });
  });
  mockedWithTransaction.mockImplementation(async (_config, run) => {
    const client = { query: jest.fn(async () => ({ rows: [], rowCount: 0 })) };
    return run(client as never);
  });
});

afterEach(() => setEmailSender(null));

describe('POST /v1/auth/email/otp on RDS', () => {
  test('returns 503 when SES is not configured instead of touching Supabase', async () => {
    mockedQueryOne.mockResolvedValueOnce({ profile_id: PROFILE_ID, platform_user_id: PLATFORM_USER_ID, email: 'ava@example.com' }); // intent check

    const res = await dispatch(makeConfig({ sesFromEmail: undefined }), '/v1/auth/email/otp', {
      email: 'ava@example.com',
      intent: 'sign_in',
    });

    expect(res._getStatusCode()).toBe(503);
    expect((res._getJson() as { error: { code: string } }).error.code).toBe('email_otp_unavailable');
  });

  test('creates a challenge and emails a six digit code', async () => {
    mockedQueryOne
      .mockResolvedValueOnce({ profile_id: PROFILE_ID, platform_user_id: PLATFORM_USER_ID, email: 'ava@example.com' }) // intent check
      .mockResolvedValueOnce({ count: '0' }); // recent challenge count

    const res = await dispatch(makeConfig(), '/v1/auth/email/otp', {
      email: 'Ava@Example.com',
      intent: 'sign_in',
    });

    expect(res._getStatusCode()).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ava@example.com');
    expect(sent[0].subject).toMatch(/^\d{6} is your HNNT sign-in code$/u);
    expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
  });

  test('throttles repeated code requests for one address', async () => {
    mockedQueryOne
      .mockResolvedValueOnce({ profile_id: PROFILE_ID, platform_user_id: PLATFORM_USER_ID, email: 'ava@example.com' })
      .mockResolvedValueOnce({ count: '5' });

    const res = await dispatch(makeConfig(), '/v1/auth/email/otp', {
      email: 'ava@example.com',
      intent: 'sign_in',
    });

    expect(res._getStatusCode()).toBe(429);
    expect(sent).toHaveLength(0);
  });
});

describe('POST /v1/auth/email/verify on RDS', () => {
  test('rejects a wrong or expired code', async () => {
    mockedQueryOne.mockResolvedValueOnce(null); // consume returns no row

    const res = await dispatch(makeConfig(), '/v1/auth/email/verify', {
      email: 'ava@example.com',
      token: '000000',
      intent: 'sign_in',
    });

    expect(res._getStatusCode()).toBe(401);
  });

  test('issues a session for an existing account on sign in', async () => {
    mockedQueryOne
      .mockResolvedValueOnce({ id: 'link-1' }) // consume
      .mockResolvedValueOnce({ profile_id: PROFILE_ID, platform_user_id: PLATFORM_USER_ID, email: 'ava@example.com' }) // find by email
      .mockResolvedValueOnce({ id: 'session-1' }) // insert session
      .mockResolvedValueOnce({ // profile aggregate
        id: PROFILE_ID, username: 'ava', name: 'Ava', display_name: 'Ava', email: 'ava@example.com',
        avatar_url: null, bio: null, privacy: 'private', is_public: false, mutuals_only: false,
        subscription_tier: 'free', age: 22, age_verified: true, profile_image_id: null,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      });
    (jest.requireMock('../db').queryRows as jest.Mock).mockResolvedValue([]);

    const res = await dispatch(makeConfig(), '/v1/auth/email/verify', {
      email: 'ava@example.com',
      token: '123456',
      intent: 'sign_in',
    });

    expect(res._getStatusCode()).toBe(200);
    const body = res._getJson() as { data: { accessToken: string; refreshToken: string; me: { profile: { username: string } } } };
    expect(body.data.accessToken).toMatch(/^hinto_at_/u);
    expect(body.data.refreshToken).toMatch(/^hinto_rt_/u);
    expect(body.data.me.profile.username).toBe('ava');
  });

  test('refuses sign up for an email that already has an account', async () => {
    mockedQueryOne
      .mockResolvedValueOnce({ id: 'link-1' })
      .mockResolvedValueOnce({ profile_id: PROFILE_ID, platform_user_id: PLATFORM_USER_ID, email: 'ava@example.com' });

    const res = await dispatch(makeConfig(), '/v1/auth/email/verify', {
      email: 'ava@example.com',
      token: '123456',
      intent: 'sign_up',
      username: 'ava',
      displayName: 'Ava',
    });

    expect(res._getStatusCode()).toBe(409);
  });
});
