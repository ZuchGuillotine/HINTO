import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AppConfig, LogLevel } from './types.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_LOG_LEVEL: LogLevel = 'info';

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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotEnv(env);

  return {
    apiName: env.API_NAME ?? 'hinto-api',
    host: env.API_HOST ?? DEFAULT_HOST,
    port: parsePort(env.API_PORT),
    corsAllowOrigin:
      env.API_CORS_ALLOW_ORIGIN ??
      (env.NODE_ENV === 'production' ? 'https://hinto.app' : '*'),
    logLevel: parseLogLevel(env.API_LOG_LEVEL),
    nodeEnv: env.NODE_ENV ?? 'development',
    supabaseUrl:
      env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey:
      env.SUPABASE_ANON_KEY ??
      env.PUBLIC_SUPABASE_ANON_KEY ??
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    openAiApiKey: env.OPENAI_API_KEY,
  };
}
