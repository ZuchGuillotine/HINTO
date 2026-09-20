import { routeRequest } from '../routes';
import { deletePostgresAccount } from '../repositories/postgres-auth';
import { createMockRequest, createMockResponse, createTestContext } from './helpers/http';
import { createTestConfig } from './helpers/config';

const PROFILE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PLATFORM_USER_ID = 'pppppppp-pppp-4ppp-8ppp-pppppppppppp';

jest.mock('../db', () => ({
  shouldUsePostgres: jest.fn(() => true),
  queryOne: jest.fn(),
  queryRows: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock('../supabase', () => ({
  getServiceClient: jest.fn(),
  getUserClient: jest.fn(),
}));
jest.mock('../repositories/postgres-auth', () => ({
  resolvePostgresAccessToken: jest.fn(async () => ({
    authUserId: PLATFORM_USER_ID,
    profileId: PROFILE_ID,
    email: 'ava@example.com',
  })),
  deletePostgresAccount: jest.fn(async () => ({ deletedProfile: true, deletedPlatformUser: true })),
}));

const config = createTestConfig({ nodeEnv: 'development', developmentAuthEnabled: false });

function dispatch(headers: Record<string, string>) {
  const req = createMockRequest({ method: 'DELETE', url: '/v1/me', headers });
  const res = createMockResponse();
  return new Promise<typeof res>((resolve) => {
    res.on('finish', () => resolve(res));
    routeRequest(req, res, createTestContext(), config);
  });
}

describe('DELETE /v1/me', () => {
  test('deletes the profile and platform user in one call', async () => {
    const res = await dispatch({ authorization: 'Bearer hinto_at_test' });

    expect(res._getStatusCode()).toBe(200);
    expect(deletePostgresAccount).toHaveBeenCalledWith(config, {
      profileId: PROFILE_ID,
      platformUserId: PLATFORM_USER_ID,
    });
    const body = res._getJson() as { data: { deleted: boolean; profileId: string } };
    expect(body.data).toEqual({ deleted: true, profileId: PROFILE_ID });
  });

  test('requires authentication', async () => {
    const res = await dispatch({});
    expect(res._getStatusCode()).toBe(401);
    expect(deletePostgresAccount).not.toHaveBeenCalledTimes(2);
  });

  test('is advertised in route discovery', async () => {
    const req = createMockRequest({ method: 'GET', url: '/v1' });
    const res = createMockResponse();
    await new Promise<void>((resolve) => {
      res.on('finish', () => resolve());
      routeRequest(req, res, createTestContext(), config);
    });
    const body = res._getJson() as { data: { routes: string[] } };
    expect(body.data.routes).toContain('DELETE /v1/me');
  });
});
