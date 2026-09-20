import { loadConfig } from '../config';

describe('loadConfig', () => {
  test('keeps development auth and email OTP bypass disabled by default', () => {
    const config = loadConfig({
      NODE_ENV: 'staging',
      ENABLE_DEVELOPMENT_AUTH: '',
      DISABLE_EMAIL_OTP_DELIVERY: '',
    });

    expect(config.nodeEnv).toBe('staging');
    expect(config.developmentAuthEnabled).toBe(false);
    expect(config.emailOtpDeliveryDisabled).toBe(false);
  });

  test('maps local provider credential aliases and localhost callback defaults', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      SNAPCHAT_CLIENT_CONFIDENTIAL: 'snap-confidential',
      SNAPCHAT_CLIENT_ID_PUBLIC: 'snap-public',
      SNAPCHAT_CLIENT_SECRET: 'snap-secret',
      TIKTOK_CLIENT_ID_PUBLIC: 'tiktok-public',
      TIKTOK_CLIENT_SECRET: 'tiktok-secret',
      META_APP_ID: 'meta-app',
      META_CLIENT_SECRET: 'meta-secret',
      AUTH_STATE_SECRET: 'state-secret',
    });

    expect(config.snapchatClientId).toBe('snap-confidential');
    expect(config.snapchatClientSecret).toBe('snap-secret');
    expect(config.snapchatRedirectUri).toBe(
      'http://localhost:3000/v1/auth/providers/snapchat/callback',
    );
    expect(config.tiktokClientKey).toBe('tiktok-public');
    expect(config.tiktokRedirectUri).toBe(
      'http://localhost:3000/v1/auth/providers/tiktok/callback',
    );
    expect(config.metaClientId).toBe('meta-app');
  });

  test('defaults production CORS to public and app hnnt origins', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
    });

    expect(config.corsAllowOrigin).toBe('https://hnnt.app,https://app.hnnt.app');
  });
});

import { assertProductionConfig } from '../config';
import { createTestConfig } from './helpers/config';

describe('assertProductionConfig', () => {
  const productionBase = () =>
    createTestConfig({
      nodeEnv: 'production',
      host: '0.0.0.0',
      corsAllowOrigin: 'https://hnnt.app',
      developmentAuthEnabled: false,
      emailOtpDeliveryDisabled: false,
    });

  test('accepts a complete production configuration', () => {
    expect(() => assertProductionConfig(productionBase())).not.toThrow();
  });

  test('is a no-op outside production', () => {
    expect(() => assertProductionConfig(createTestConfig({ databaseUrl: undefined }))).not.toThrow();
  });

  test('refuses production without DATABASE_URL or the token pepper', () => {
    expect(() => assertProductionConfig({ ...productionBase(), databaseUrl: undefined })).toThrow(/DATABASE_URL/);
    expect(() => assertProductionConfig({ ...productionBase(), refreshTokenPepper: undefined })).toThrow(/REFRESH_TOKEN_PEPPER/);
  });

  test('refuses development escape hatches and wildcard CORS in production', () => {
    expect(() => assertProductionConfig({ ...productionBase(), developmentAuthEnabled: true })).toThrow(/ENABLE_DEVELOPMENT_AUTH/);
    expect(() => assertProductionConfig({ ...productionBase(), emailOtpDeliveryDisabled: true })).toThrow(/DISABLE_EMAIL_OTP_DELIVERY/);
    expect(() => assertProductionConfig({ ...productionBase(), corsAllowOrigin: '*' })).toThrow(/API_CORS_ALLOW_ORIGIN/);
    expect(() => assertProductionConfig({ ...productionBase(), host: '127.0.0.1' })).toThrow(/API_HOST/);
  });
});
