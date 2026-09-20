import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppConfig, LogLevel } from './types.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_LOG_LEVEL: LogLevel = 'info';
const DEFAULT_IOS_BUNDLE_ID = 'app.hnnt';
const DEFAULT_APPLE_TEAM_ID = '432862NB9P';
const DEFAULT_APPLE_KEY_ID = 'U5L7DR4AND';
const DEFAULT_APPLE_PRIVATE_KEY_FILE = 'AuthKey_U5L7DR4AND.p8';

function loadDotEnv(env: NodeJS.ProcessEnv, cwd = process.cwd()): void {
  const dotEnvPath = resolve(cwd, '.env');
  if (!existsSync(dotEnvPath)) {
    return;
  }

  const file = readFileSync(dotEnvPath, 'utf8');
  for (const line of file.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid API_PORT value: ${value}`);
  }

  return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.toLowerCase();
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error'
  ) {
    return normalized;
  }

  return DEFAULT_LOG_LEVEL;
}

function parseScopes(value: string | undefined, fallback: string[]): string[] {
  const raw = value
    ?.split(/[,\s]+/u)
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!raw || raw.length === 0) {
    return fallback;
  }

  return Array.from(new Set(raw));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function readOptionalFile(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const resolvedPath = resolve(process.cwd(), path);
  if (!existsSync(resolvedPath)) {
    return undefined;
  }

  return readFileSync(resolvedPath, 'utf8');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotEnv(env);
  const nodeEnv = env.NODE_ENV ?? 'development';
  const applePrivateKey =
    env.APPLE_PRIVATE_KEY ??
    readOptionalFile(env.APPLE_PRIVATE_KEY_FILE ?? DEFAULT_APPLE_PRIVATE_KEY_FILE);
  const apnsPrivateKey =
    env.APNS_PRIVATE_KEY ??
    readOptionalFile(
      env.APNS_PRIVATE_KEY_FILE ??
        env.APPLE_PRIVATE_KEY_FILE ??
        DEFAULT_APPLE_PRIVATE_KEY_FILE,
    );

  return {
    apiName: env.API_NAME ?? 'hinto-api',
    host: env.API_HOST ?? DEFAULT_HOST,
    port: parsePort(env.API_PORT),
    corsAllowOrigin:
      env.API_CORS_ALLOW_ORIGIN ??
      (nodeEnv === 'production' ? 'https://hnnt.app,https://app.hnnt.app' : '*'),
    logLevel: parseLogLevel(env.API_LOG_LEVEL),
    nodeEnv,
    webAppUrl:
      env.WEB_APP_URL ??
      env.PUBLIC_WEB_APP_URL ??
      (nodeEnv === 'production' ? 'https://hnnt.app' : 'http://localhost:3000'),
    iosAppStoreUrl: env.IOS_APP_STORE_URL,
    databaseUrl: env.DATABASE_URL,
    supabaseUrl:
      env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey:
      env.SUPABASE_ANON_KEY ??
      env.PUBLIC_SUPABASE_ANON_KEY ??
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    developmentAuthEnabled: parseBoolean(env.ENABLE_DEVELOPMENT_AUTH, false),
    openAiApiKey: env.OPENAI_API_KEY,
    emailOtpDeliveryDisabled: parseBoolean(
      env.DISABLE_EMAIL_OTP_DELIVERY,
      false,
    ),
    awsRegion: env.AWS_REGION,
    s3MediaBucket: env.S3_MEDIA_BUCKET,
    s3WebBucket: env.S3_WEB_BUCKET,
    cloudfrontMediaDomain: env.CLOUDFRONT_MEDIA_DOMAIN,
    sesFromEmail: env.SES_FROM_EMAIL,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    jwtAccessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenPepper: env.REFRESH_TOKEN_PEPPER,
    authStateSecret: env.AUTH_STATE_SECRET,
    appleClientId: env.APPLE_CLIENT_ID ?? DEFAULT_IOS_BUNDLE_ID,
    appleTeamId: env.APPLE_TEAM_ID ?? DEFAULT_APPLE_TEAM_ID,
    appleKeyId: env.APPLE_KEY_ID ?? DEFAULT_APPLE_KEY_ID,
    applePrivateKey,
    apnsTeamId: env.APNS_TEAM_ID ?? env.APPLE_TEAM_ID ?? DEFAULT_APPLE_TEAM_ID,
    apnsKeyId: env.APNS_KEY_ID ?? env.APPLE_KEY_ID ?? DEFAULT_APPLE_KEY_ID,
    apnsBundleId: env.APNS_BUNDLE_ID ?? DEFAULT_IOS_BUNDLE_ID,
    apnsPrivateKey,
    metaClientId: env.META_CLIENT_ID ?? env.META_APP_ID,
    metaClientSecret: env.META_CLIENT_SECRET,
    tiktokClientKey: env.TIKTOK_CLIENT_KEY ?? env.TIKTOK_CLIENT_ID_PUBLIC,
    tiktokClientSecret: env.TIKTOK_CLIENT_SECRET,
    tiktokRedirectUri:
      env.TIKTOK_REDIRECT_URI ??
      (nodeEnv === 'production'
        ? undefined
        : 'http://localhost:3000/v1/auth/providers/tiktok/callback'),
    tiktokScopes: parseScopes(env.TIKTOK_SCOPES, ['user.info.basic']),
    snapchatClientId:
      env.SNAPCHAT_CLIENT_ID ??
      env.SNAPCHAT_CLIENT_CONFIDENTIAL ??
      env.SNAPCHAT_CLIENT_ID_PUBLIC,
    snapchatClientSecret: env.SNAPCHAT_CLIENT_SECRET,
    snapchatRedirectUri:
      env.SNAPCHAT_REDIRECT_URI ??
      (nodeEnv === 'production'
        ? undefined
        : 'http://localhost:3000/v1/auth/providers/snapchat/callback'),
    snapchatScopes: parseScopes(env.SNAPCHAT_SCOPES, [
      'https://auth.snapchat.com/oauth2/api/user.display_name',
      'https://auth.snapchat.com/oauth2/api/user.external_id',
    ]),
  };
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Refuses to serve production traffic with a configuration that would either
 * fall back to the Supabase transition path or run with development-only
 * escape hatches. Called once at boot by server.ts.
 */
export function assertProductionConfig(config: AppConfig): void {
  if (config.nodeEnv !== 'production') {
    return;
  }

  const problems: string[] = [];

  if (!config.databaseUrl) {
    problems.push('DATABASE_URL is required (RDS Postgres is the production data store)');
  }
  if (!config.refreshTokenPepper) {
    problems.push('REFRESH_TOKEN_PEPPER is required so session tokens are not hashed with the local default');
  }
  if (!config.jwtAccessTokenSecret) {
    problems.push('JWT_ACCESS_TOKEN_SECRET is required');
  }
  if (config.developmentAuthEnabled) {
    problems.push('ENABLE_DEVELOPMENT_AUTH must not be true in production');
  }
  if (config.emailOtpDeliveryDisabled) {
    problems.push('DISABLE_EMAIL_OTP_DELIVERY must not be true in production');
  }
  if (config.corsAllowOrigin === '*') {
    problems.push('API_CORS_ALLOW_ORIGIN must list explicit origins in production');
  }
  if (config.host !== '0.0.0.0') {
    problems.push('API_HOST must be 0.0.0.0 inside the container so the ALB can reach the task');
  }
  const hasCustomProvider = Boolean(config.tiktokClientKey || config.snapchatClientId || config.metaClientId);
  if (hasCustomProvider && !config.authStateSecret) {
    problems.push('AUTH_STATE_SECRET is required when any OAuth provider is configured');
  }

  if (problems.length > 0) {
    throw new ConfigError(`Refusing to start in production:\n- ${problems.join('\n- ')}`);
  }
}
