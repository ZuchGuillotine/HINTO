import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

import { AppError } from './errors.js';

interface AppleJwk {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface AppleJwtHeader {
  alg: string;
  kid: string;
}

interface AppleIdentityClaims {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: string | boolean;
}

let cachedKeys: { keys: AppleJwk[]; expiresAt: number } | null = null;

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString('utf8')) as T;
}

async function getAppleKeys(): Promise<AppleJwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }

  const response = await fetch('https://appleid.apple.com/auth/keys');
  if (!response.ok) {
    throw new AppError('apple_key_fetch_failed', 'Failed to fetch Apple public keys', 502);
  }

  const body = (await response.json()) as { keys?: AppleJwk[] };
  cachedKeys = {
    keys: body.keys ?? [],
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return cachedKeys.keys;
}

function assertAudience(claims: AppleIdentityClaims, expectedAudience: string): void {
  if (claims.aud !== expectedAudience) {
    throw new AppError('invalid_apple_token', 'Apple token audience does not match this app', 401);
  }
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  expectedAudience: string,
): Promise<AppleIdentityClaims> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) {
    throw new AppError('invalid_apple_token', 'Invalid Apple identity token', 401);
  }

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodeJson<AppleJwtHeader>(encodedHeader);
  const claims = decodeJson<AppleIdentityClaims>(encodedClaims);

  if (header.alg !== 'RS256') {
    throw new AppError('invalid_apple_token', 'Unsupported Apple token signature', 401);
  }
  if (claims.iss !== 'https://appleid.apple.com') {
    throw new AppError('invalid_apple_token', 'Apple token issuer is invalid', 401);
  }
  if (!claims.sub) {
    throw new AppError('invalid_apple_token', 'Apple token subject is missing', 401);
  }
  if (claims.exp * 1000 <= Date.now()) {
    throw new AppError('invalid_apple_token', 'Apple token has expired', 401);
  }
  assertAudience(claims, expectedAudience);

  const key = (await getAppleKeys()).find((candidate) => candidate.kid === header.kid);
  if (!key) {
    throw new AppError('invalid_apple_token', 'No matching Apple public key found', 401);
  }

  const publicKey = createPublicKey({ key: key as unknown as JsonWebKey, format: 'jwk' });
  const isValid = verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    publicKey,
    base64UrlDecode(encodedSignature),
  );

  if (!isValid) {
    throw new AppError('invalid_apple_token', 'Apple token signature is invalid', 401);
  }

  return claims;
}
