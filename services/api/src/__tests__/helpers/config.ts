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
    corsAllowOrigins: ['*'],
    logLevel: 'error',
    nodeEnv: 'test',
    enableDevAuth: false,
    allowedRedirectUris: [],
    publicWebBaseUrl: 'https://hinto.test',
    openAiModel: 'test-model',
    aiDailyMessageLimitFree: 20,
    aiDailyMessageLimitPremium: 200,
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: 'test-service-role-key',
    tiktokScopes: [],
    snapchatScopes: [],
    ...overrides,
  };
}
