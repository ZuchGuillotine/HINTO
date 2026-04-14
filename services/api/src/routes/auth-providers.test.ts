import test from 'node:test';
import assert from 'node:assert/strict';

import { testExports } from './auth-providers.js';

test('deriveSyntheticEmail produces stable reserved-domain aliases', () => {
  assert.equal(
    testExports.deriveSyntheticEmail('tiktok', 'User 123'),
    'tiktok-user-123@users.hinto.invalid',
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
    'test-secret',
  );

  const parsed = testExports.readSignedState(signed, 'tiktok', 'test-secret');
  assert.equal(parsed.clientRedirectUri, 'hinto://auth/callback');
  assert.equal(parsed.codeVerifier, 'verifier');
});

test('buildClientRedirectUrl encodes payload into URL fragments', () => {
  assert.equal(
    testExports.buildClientRedirectUrl('hinto://auth/callback', {
      provider: 'tiktok',
      accessToken: 'abc',
      expiresAt: 42,
    }),
    'hinto://auth/callback#provider=tiktok&accessToken=abc&expiresAt=42',
  );
});
