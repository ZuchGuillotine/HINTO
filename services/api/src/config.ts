import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppConfig, LogLevel } from './types.js';

const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL: LogLevel = 'info';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_AI_LIMIT_FREE = 20;
const DEFAULT_AI_LIMIT_PREMIUM = 200;
const DEFAULT_WEB_BASE_URL = 'https://hinto.app';

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\s]+/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

function parseNonNegativeInt(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }
  return parsed;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Throws when the configuration cannot safely serve traffic.
 * Called by the server at boot; unit tests build config directly.
 */
export function assertConfigValid(config: AppConfig): void {
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
  if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.nodeEnv === 'production') {
    if (process.env.API_ENABLE_DEV_AUTH !== undefined) {
      throw new ConfigError('API_ENABLE_DEV_AUTH must not be set when NODE_ENV=production');
    }
    if (config.corsAllowOrigins.includes('*')) {
      throw new ConfigError('API_CORS_ALLOW_ORIGIN must list explicit origins in production');
    }
    if (!config.authStateSecret && (config.tiktokClientKey || config.snapchatClientId)) {
      throw new ConfigError(
        'AUTH_STATE_SECRET is required when a custom auth provider is configured'
      );
    }
  }
}

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
    throw new Error(`Invalid port value: ${value}`);
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
    .map(scope => scope.trim())
    .filter(Boolean);

  if (!raw || raw.length === 0) {
    return fallback;
  }

  return Array.from(new Set(raw));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotEnv(env);

  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const webBaseUrl = env.PUBLIC_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL;
  const corsFromEnv = parseList(env.API_CORS_ALLOW_ORIGIN);

  return {
    apiName: env.API_NAME ?? 'hinto-api',
    // Containers and PaaS hosts need 0.0.0.0; local dev keeps loopback.
    host: env.API_HOST ?? (isProduction ? '0.0.0.0' : '127.0.0.1'),
    // PORT is the PaaS convention (Fly, Render, Railway, Heroku); API_PORT wins when set.
    port: parsePort(env.API_PORT ?? env.PORT),
    corsAllowOrigins: corsFromEnv.length > 0 ? corsFromEnv : isProduction ? [webBaseUrl] : ['*'],
    logLevel: parseLogLevel(env.API_LOG_LEVEL),
    nodeEnv,
    enableDevAuth: !isProduction && parseBoolean(env.API_ENABLE_DEV_AUTH),
    allowedRedirectUris: parseList(env.AUTH_ALLOWED_REDIRECT_URIS),
    publicApiBaseUrl: env.PUBLIC_API_BASE_URL,
    publicWebBaseUrl: webBaseUrl,
    supabaseUrl: env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey:
      env.SUPABASE_ANON_KEY ?? env.PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    aiDailyMessageLimitFree: parseNonNegativeInt(
      env.AI_DAILY_MESSAGE_LIMIT_FREE,
      DEFAULT_AI_LIMIT_FREE,
      'AI_DAILY_MESSAGE_LIMIT_FREE'
    ),
    aiDailyMessageLimitPremium: parseNonNegativeInt(
      env.AI_DAILY_MESSAGE_LIMIT_PREMIUM,
      DEFAULT_AI_LIMIT_PREMIUM,
      'AI_DAILY_MESSAGE_LIMIT_PREMIUM'
    ),
    authStateSecret: env.AUTH_STATE_SECRET,
    tiktokClientKey: env.TIKTOK_CLIENT_KEY,
    tiktokClientSecret: env.TIKTOK_CLIENT_SECRET,
    tiktokRedirectUri: env.TIKTOK_REDIRECT_URI,
    tiktokScopes: parseScopes(env.TIKTOK_SCOPES, ['user.info.basic']),
    snapchatClientId: env.SNAPCHAT_CLIENT_ID,
    snapchatClientSecret: env.SNAPCHAT_CLIENT_SECRET,
    snapchatRedirectUri: env.SNAPCHAT_REDIRECT_URI,
    snapchatScopes: parseScopes(env.SNAPCHAT_SCOPES, [
      'https://auth.snapchat.com/oauth2/api/user.display_name',
      'https://auth.snapchat.com/oauth2/api/user.external_id',
    ]),
  };
}
