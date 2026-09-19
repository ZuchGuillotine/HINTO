import { testExports } from './auth-providers';

test('deriveSyntheticEmail produces stable reserved-domain aliases', () => {
  expect(testExports.deriveSyntheticEmail('tiktok', 'User 123')).toBe(
    'tiktok-user-123@users.hinto.invalid'
  );
});

test('signState round-trips provider auth state payloads', () => {
  const signed = testExports.signState(
    {
      provider: 'tiktok',
      clientRedirectUri: 'hinto://auth/callback',
      platform: 'mobile',
      issuedAt: Date.now(),
      nonce: 'abc123',
      codeVerifier: 'verifier',
    },
    'test-secret'
  );

  const parsed = testExports.readSignedState(signed, 'tiktok', 'test-secret');
  expect(parsed.clientRedirectUri).toBe('hinto://auth/callback');
  expect(parsed.codeVerifier).toBe('verifier');
});

test('buildClientRedirectUrl encodes payload into URL fragments', () => {
  expect(
    testExports.buildClientRedirectUrl('hinto://auth/callback', {
      provider: 'tiktok',
      accessToken: 'abc',
      expiresAt: 42,
    })
  ).toBe('hinto://auth/callback#provider=tiktok&accessToken=abc&expiresAt=42');
});

import { assertClientRedirectUri } from './auth-providers';
import { createTestConfig } from '../__tests__/helpers/config';

describe('assertClientRedirectUri', () => {
  test('refuses every redirect when no allowlist is configured', () => {
    expect(() => assertClientRedirectUri('hinto://auth/callback', createTestConfig())).toThrow(
      /AUTH_ALLOWED_REDIRECT_URIS/
    );
  });

  test('accepts exact and prefix matches only', () => {
    const config = createTestConfig({
      allowedRedirectUris: ['hinto://auth/callback', 'https://hinto.app/auth/*'],
    });
    expect(assertClientRedirectUri('hinto://auth/callback', config)).toBe('hinto://auth/callback');
    expect(assertClientRedirectUri('https://hinto.app/auth/done', config)).toBe(
      'https://hinto.app/auth/done'
    );
    expect(() => assertClientRedirectUri('https://evil.example/steal', config)).toThrow(
      /allowlist/
    );
    expect(() => assertClientRedirectUri('hinto://auth/callback/extra', config)).toThrow(
      /allowlist/
    );
  });
});
