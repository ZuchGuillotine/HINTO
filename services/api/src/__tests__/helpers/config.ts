import { AppConfig } from '../../types';

/**
 * Returns an AppConfig suitable for unit tests.
 * Supabase values are fake — the real client is mocked.
 */
export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    apiName: 'hinto-api-test',
    host: '127.0.0.1',
    port: 0,
    corsAllowOrigin: '*',
    logLevel: 'error',
    nodeEnv: 'test',
    webAppUrl: 'https://hnnt.test',
    databaseUrl: 'postgres://test:test@localhost:5432/hinto_test',
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: 'test-service-role-key',
    developmentAuthEnabled: true,
    emailOtpDeliveryDisabled: true,
    awsRegion: 'us-west-2',
    s3MediaBucket: 'hinto-test-media',
    s3WebBucket: 'hinto-test-web',
    cloudfrontMediaDomain: 'media.test.hinto.app',
    sesFromEmail: 'test@hinto.app',
    jwtIssuer: 'hinto-api-test',
    jwtAudience: 'hinto-test',
    jwtAccessTokenSecret: 'test-access-token-secret',
    refreshTokenPepper: 'test-refresh-token-pepper',
    tiktokScopes: [],
    snapchatScopes: [],
    ...overrides,
  };
}
