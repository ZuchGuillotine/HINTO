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
