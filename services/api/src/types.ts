export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  apiName: string;
  host: string;
  port: number;
  corsAllowOrigin: string;
  logLevel: LogLevel;
  nodeEnv: string;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  openAiApiKey?: string;
  emailOtpDeliveryDisabled: boolean;
  awsRegion?: string;
  s3MediaBucket?: string;
  s3WebBucket?: string;
  cloudfrontMediaDomain?: string;
  sesFromEmail?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  jwtAccessTokenSecret?: string;
  refreshTokenPepper?: string;
  authStateSecret?: string;
  appleClientId?: string;
  appleTeamId?: string;
  appleKeyId?: string;
  applePrivateKey?: string;
  metaClientId?: string;
  metaClientSecret?: string;
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
