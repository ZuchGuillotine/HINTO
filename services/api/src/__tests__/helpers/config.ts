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
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: 'test-service-role-key',
    tiktokScopes: [],
    snapchatScopes: [],
    ...overrides,
  };
}
