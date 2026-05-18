import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { IncomingMessage } from 'node:http';

import { AppError } from '../errors.js';
import { AppConfig } from '../types.js';
import { queryOne, withTransaction } from '../db.js';
import { ProfileRow } from '../routes/profile.js';

const PASSWORD_PREFIX = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

interface AuthProfileRow {
  profile_id: string;
  platform_user_id: string;
  email: string | null;
}

export interface PostgresSessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  profileId: string;
  platformUserId: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/_{2,}/gu, '_')
    .replace(/^_|_$/gu, '') || 'user';
}

function hashToken(config: AppConfig, token: string): string {
  const pepper =
    config.refreshTokenPepper ??
    config.authStateSecret ??
    config.jwtAccessTokenSecret ??
    'hinto-local-auth-pepper';
  return createHash('sha256').update(`${token}:${pepper}`).digest('hex');
}

function makeToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

function displayNameFromUsername(username: string): string {
  return username
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function usernameFromEmail(email: string | null | undefined, fallback: string): string {
  if (!email) {
    return normalizeUsername(fallback);
  }
  return normalizeUsername(email.split('@')[0] ?? fallback);
}

async function chooseAvailableUsername(
  client: Parameters<Parameters<typeof withTransaction>[1]>[0],
  preferred: string,
): Promise<string> {
  const base = normalizeUsername(preferred);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}_${attempt + 1}`;
    const existing = await client.query(
      'SELECT 1 FROM profiles WHERE lower(username) = lower($1) LIMIT 1',
      [candidate],
    );
    if (!existing.rows[0]) {
      return candidate;
    }
  }

  return `${base}_${randomBytes(4).toString('hex')}`;
}

function requestIpAddress(request: IncomingMessage): string | null {
  const forwardedFor = request.headers['x-forwarded-for'];
  const firstForwarded =
    typeof forwardedFor === 'string' ? forwardedFor.split(',')[0]?.trim() : undefined;
  const raw = firstForwarded || request.socket.remoteAddress;
  if (!raw) {
    return null;
  }
  if (raw === '::1') {
    return '127.0.0.1';
  }
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const derived = await derivePasswordKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    PASSWORD_PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    derived.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, nRaw, rRaw, pRaw, salt, hashRaw] = storedHash.split('$');
  if (prefix !== PASSWORD_PREFIX || !nRaw || !rRaw || !pRaw || !salt || !hashRaw) {
    return false;
  }

  const expected = Buffer.from(hashRaw, 'base64url');
  const actual = await derivePasswordKey(password, salt, expected.length, {
    N: Number.parseInt(nRaw, 10),
    r: Number.parseInt(rRaw, 10),
    p: Number.parseInt(pRaw, 10),
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function derivePasswordKey(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export function assertPasswordAllowed(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      'validation_error',
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      400,
    );
  }

  return password;
}

export async function createEmailPasswordAccount(
  config: AppConfig,
  input: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  },
): Promise<AuthProfileRow> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const displayName = input.displayName.trim() || displayNameFromUsername(username);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(config, async (client) => {
    const existingAccount = await client.query(
      `SELECT 1
         FROM profiles
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email],
    );
    if (existingAccount.rows[0]) {
      throw new AppError(
        'account_exists',
        'A HINTO account already exists for this email. Use sign in instead.',
        409,
      );
    }

    const existingUsername = await client.query(
      `SELECT 1
         FROM profiles
        WHERE lower(username) = lower($1)
        LIMIT 1`,
      [username],
    );
    if (existingUsername.rows[0]) {
      throw new AppError('username_taken', 'That username is already taken', 409);
    }

    const platformUser = await client.query<{ id: string }>(
      `INSERT INTO platform_users(primary_email, display_name)
       VALUES ($1, $2)
       RETURNING id`,
      [email, displayName],
    );
    const platformUserId = platformUser.rows[0].id;

    const profile = await client.query<Pick<ProfileRow, 'id' | 'email'>>(
      `INSERT INTO profiles(
         platform_user_id,
         email,
         username,
         name,
         display_name,
         privacy,
         is_public,
         mutuals_only
       )
       VALUES ($1, $2, $3, $4, $4, 'private', false, false)
       RETURNING id, email`,
      [platformUserId, email, username, displayName],
    );

    await client.query(
      `INSERT INTO auth_identities(
         platform_user_id,
         provider,
         provider_user_id,
         provider_email,
         provider_email_verified,
         provider_username,
         provider_display_name,
         is_primary,
         last_used_at
       )
       VALUES ($1, 'email', $2, $2, true, $3, $4, true, now())`,
      [platformUserId, email, username, displayName],
    );

    await client.query(
      `INSERT INTO auth_password_credentials(platform_user_id, password_hash)
       VALUES ($1, $2)`,
      [platformUserId, passwordHash],
    );

    return {
      profile_id: profile.rows[0].id,
      platform_user_id: platformUserId,
      email: profile.rows[0].email,
    };
  });
}

export async function createOrLoadAppleAccount(
  config: AppConfig,
  input: {
    appleUserId: string;
    email: string | null;
    displayName: string | null;
  },
): Promise<AuthProfileRow> {
  const email = input.email ? normalizeEmail(input.email) : null;
  const fallbackUsername = `apple_${input.appleUserId.slice(0, 8).toLowerCase()}`;

  return withTransaction(config, async (client) => {
    const existingIdentity = await client.query<AuthProfileRow>(
      `SELECT
         p.id AS profile_id,
         p.platform_user_id AS platform_user_id,
         p.email
       FROM auth_identities i
       JOIN profiles p ON p.platform_user_id = i.platform_user_id
      WHERE i.provider = 'apple'
        AND i.provider_user_id = $1
      LIMIT 1`,
      [input.appleUserId],
    );

    if (existingIdentity.rows[0]) {
      await client.query(
        `UPDATE auth_identities
            SET last_used_at = now(), updated_at = now()
          WHERE platform_user_id = $1
            AND provider = 'apple'`,
        [existingIdentity.rows[0].platform_user_id],
      );
      return existingIdentity.rows[0];
    }

    const profile = email
      ? await client.query<AuthProfileRow>(
          `SELECT
             id AS profile_id,
             platform_user_id AS platform_user_id,
             email
           FROM profiles
          WHERE lower(email) = lower($1)
            AND platform_user_id IS NOT NULL
          LIMIT 1`,
          [email],
        )
      : null;

    let platformUserId = profile?.rows[0]?.platform_user_id;
    let profileId = profile?.rows[0]?.profile_id;
    let profileEmail = profile?.rows[0]?.email ?? email;

    if (!platformUserId || !profileId) {
      const username = await chooseAvailableUsername(
        client,
        usernameFromEmail(email, fallbackUsername),
      );
      const displayName =
        input.displayName?.trim() || displayNameFromUsername(username) || 'HINTO User';

      const platformUser = await client.query<{ id: string }>(
        `INSERT INTO platform_users(primary_email, display_name)
         VALUES ($1, $2)
         RETURNING id`,
        [email, displayName],
      );
      platformUserId = platformUser.rows[0].id;

      const insertedProfile = await client.query<Pick<ProfileRow, 'id' | 'email'>>(
        `INSERT INTO profiles(
           platform_user_id,
           email,
           username,
           name,
           display_name,
           privacy,
           is_public,
           mutuals_only
         )
         VALUES ($1, $2, $3, $4, $4, 'private', false, false)
         RETURNING id, email`,
        [platformUserId, email, username, displayName],
      );
      profileId = insertedProfile.rows[0].id;
      profileEmail = insertedProfile.rows[0].email;
    }

    const existingPrimary = await client.query(
      `SELECT 1
         FROM auth_identities
        WHERE platform_user_id = $1
          AND is_primary = true
        LIMIT 1`,
      [platformUserId],
    );

    await client.query(
      `INSERT INTO auth_identities(
         platform_user_id,
         provider,
         provider_user_id,
         provider_email,
         provider_email_verified,
         provider_display_name,
         provider_metadata,
         is_primary,
         last_used_at
       )
       VALUES ($1, 'apple', $2, $3, $4, $5, '{}'::jsonb, $6, now())
       ON CONFLICT (provider, provider_user_id)
       DO UPDATE SET
         platform_user_id = EXCLUDED.platform_user_id,
         provider_email = COALESCE(EXCLUDED.provider_email, auth_identities.provider_email),
         provider_email_verified = EXCLUDED.provider_email_verified,
         provider_display_name = COALESCE(EXCLUDED.provider_display_name, auth_identities.provider_display_name),
         last_used_at = now(),
         updated_at = now()`,
      [
        platformUserId,
        input.appleUserId,
        email,
        Boolean(email),
        input.displayName,
        !existingPrimary.rows[0],
      ],
    );

    return {
      profile_id: profileId,
      platform_user_id: platformUserId,
      email: profileEmail,
    };
  });
}

export async function authenticateEmailPassword(
  config: AppConfig,
  input: {
    email: string;
    password: string;
  },
): Promise<AuthProfileRow> {
  const email = normalizeEmail(input.email);
  const row = await queryOne<AuthProfileRow & { password_hash: string }>(
    config,
    `SELECT
       p.id AS profile_id,
       p.platform_user_id AS platform_user_id,
       p.email,
       c.password_hash
     FROM profiles p
     JOIN auth_password_credentials c ON c.platform_user_id = p.platform_user_id
    WHERE lower(p.email) = lower($1)
      AND p.platform_user_id IS NOT NULL
    LIMIT 1`,
    [email],
  );

  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    throw new AppError('invalid_credentials', 'Invalid email or password', 401);
  }

  await queryOne(
    config,
    `UPDATE auth_identities
        SET last_used_at = now(), updated_at = now()
      WHERE platform_user_id = $1
        AND provider = 'email'
      RETURNING id`,
    [row.platform_user_id],
  );

  return {
    profile_id: row.profile_id,
    platform_user_id: row.platform_user_id,
    email: row.email,
  };
}

export async function createPostgresAuthSession(
  config: AppConfig,
  request: IncomingMessage,
  authProfile: AuthProfileRow,
): Promise<PostgresSessionData> {
  const accessToken = makeToken('hinto_at');
  const refreshToken = makeToken('hinto_rt');
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const accessExpiresAt = new Date(expiresAt * 1000);

  await queryOne<{ id: string }>(
    config,
    `INSERT INTO auth_sessions(
       platform_user_id,
       app_key,
       refresh_token_hash,
       access_token_hash,
       access_token_expires_at,
       user_agent,
       ip_address,
       expires_at,
       last_used_at
     )
     VALUES ($1, 'hinto', $2, $3, $4, $5, $6::inet, $7, now())
     RETURNING id`,
    [
      authProfile.platform_user_id,
      hashToken(config, refreshToken),
      hashToken(config, accessToken),
      accessExpiresAt,
      request.headers['user-agent'] ?? null,
      requestIpAddress(request),
      refreshExpiresAt,
    ],
  );

  return {
    accessToken,
    refreshToken,
    expiresAt,
    profileId: authProfile.profile_id,
    platformUserId: authProfile.platform_user_id,
  };
}

export async function resolvePostgresAccessToken(
  config: AppConfig,
  token: string,
): Promise<{ authUserId: string; profileId: string; email: string | null } | null> {
  const row = await queryOne<AuthProfileRow>(
    config,
    `SELECT
       p.id AS profile_id,
       s.platform_user_id AS platform_user_id,
       p.email
     FROM auth_sessions s
     JOIN profiles p ON p.platform_user_id = s.platform_user_id
    WHERE s.access_token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND s.access_token_expires_at > now()
    LIMIT 1`,
    [hashToken(config, token)],
  );

  if (!row) {
    return null;
  }

  await queryOne(
    config,
    'UPDATE auth_sessions SET last_used_at = now() WHERE access_token_hash = $1 RETURNING id',
    [hashToken(config, token)],
  );

  return {
    authUserId: row.platform_user_id,
    profileId: row.profile_id,
    email: row.email,
  };
}

export async function refreshPostgresAuthSession(
  config: AppConfig,
  request: IncomingMessage,
  refreshToken: string,
): Promise<PostgresSessionData | null> {
  const existing = await queryOne<AuthProfileRow>(
    config,
    `SELECT
       p.id AS profile_id,
       s.platform_user_id AS platform_user_id,
       p.email
     FROM auth_sessions s
     JOIN profiles p ON p.platform_user_id = s.platform_user_id
    WHERE s.refresh_token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1`,
    [hashToken(config, refreshToken)],
  );

  if (!existing) {
    return null;
  }

  const accessToken = makeToken('hinto_at');
  const nextRefreshToken = makeToken('hinto_rt');
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;

  await queryOne(
    config,
    `UPDATE auth_sessions
        SET refresh_token_hash = $2,
            access_token_hash = $3,
            access_token_expires_at = $4,
            user_agent = $5,
            ip_address = $6::inet,
            last_used_at = now()
      WHERE refresh_token_hash = $1
      RETURNING id`,
    [
      hashToken(config, refreshToken),
      hashToken(config, nextRefreshToken),
      hashToken(config, accessToken),
      new Date(expiresAt * 1000),
      request.headers['user-agent'] ?? null,
      requestIpAddress(request),
    ],
  );

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresAt,
    profileId: existing.profile_id,
    platformUserId: existing.platform_user_id,
  };
}
