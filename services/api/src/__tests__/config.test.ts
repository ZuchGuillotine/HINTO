import { assertConfigValid, loadConfig } from '../config';

const BASE_ENV: NodeJS.ProcessEnv = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

describe('loadConfig', () => {
  test('defaults to loopback host and 3000 outside production', () => {
    const config = loadConfig({ ...BASE_ENV });
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.corsAllowOrigins).toEqual(['*']);
    expect(config.enableDevAuth).toBe(false);
  });

  test('binds 0.0.0.0, honors PORT, and restricts CORS in production', () => {
    const config = loadConfig({ ...BASE_ENV, NODE_ENV: 'production', PORT: '8080' });
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.corsAllowOrigins).toEqual(['https://hinto.app']);
  });

  test('never enables dev auth in production even when asked', () => {
    const config = loadConfig({ ...BASE_ENV, NODE_ENV: 'production', API_ENABLE_DEV_AUTH: 'true' });
    expect(config.enableDevAuth).toBe(false);
  });

  test('enables dev auth only with the explicit flag', () => {
    expect(loadConfig({ ...BASE_ENV, API_ENABLE_DEV_AUTH: 'true' }).enableDevAuth).toBe(true);
    expect(loadConfig({ ...BASE_ENV }).enableDevAuth).toBe(false);
  });

  test('parses comma separated allowlists', () => {
    const config = loadConfig({
      ...BASE_ENV,
      API_CORS_ALLOW_ORIGIN: 'https://a.com, https://b.com',
      AUTH_ALLOWED_REDIRECT_URIS: 'hinto://auth/callback,https://hinto.app/auth/*',
    });
    expect(config.corsAllowOrigins).toEqual(['https://a.com', 'https://b.com']);
    expect(config.allowedRedirectUris).toEqual([
      'hinto://auth/callback',
      'https://hinto.app/auth/*',
    ]);
  });
});

describe('assertConfigValid', () => {
  test('lists every missing Supabase variable', () => {
    expect(() => assertConfigValid(loadConfig({}))).toThrow(
      /SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY/
    );
  });

  test('rejects wildcard CORS in production', () => {
    const config = loadConfig({ ...BASE_ENV, NODE_ENV: 'production', API_CORS_ALLOW_ORIGIN: '*' });
    expect(() => assertConfigValid(config)).toThrow(/explicit origins/);
  });

  test('accepts a complete production config', () => {
    const config = loadConfig({ ...BASE_ENV, NODE_ENV: 'production' });
    expect(() => assertConfigValid(config)).not.toThrow();
  });
});
