export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  apiName: string;
  host: string;
  port: number;
  /** Exact origins allowed for CORS. `*` allows any origin (non-production only). */
  corsAllowOrigins: string[];
  logLevel: LogLevel;
  nodeEnv: string;
  /** True only when API_ENABLE_DEV_AUTH=true and NODE_ENV is not production. */
  enableDevAuth: boolean;
  /** Absolute URI prefixes that custom-provider OAuth may redirect back to. */
  allowedRedirectUris: string[];
  /** Base URL of the API itself, used for provider callbacks and links. */
  publicApiBaseUrl?: string;
  /** Base URL of the web app, used for invite links. */
  publicWebBaseUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  openAiApiKey?: string;
  openAiModel: string;
  aiDailyMessageLimitFree: number;
  aiDailyMessageLimitPremium: number;
  authStateSecret?: string;
  tiktokClientKey?: string;
  tiktokClientSecret?: string;
  tiktokRedirectUri?: string;
  tiktokScopes: string[];
  snapchatClientId?: string;
  snapchatClientSecret?: string;
  snapchatRedirectUri?: string;
  snapchatScopes: string[];
}

export interface RequestContext {
  requestId: string;
  startedAt: number;
}

export interface JsonSuccessEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
  };
}

export interface JsonErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}
