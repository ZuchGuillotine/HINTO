export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  apiName: string;
  host: string;
  port: number;
  corsAllowOrigin: string;
  logLevel: LogLevel;
  nodeEnv: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  openAiApiKey?: string;
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
