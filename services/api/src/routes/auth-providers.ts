import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

import { readJsonBody } from '../body.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { fetchMeAggregateForProfileId } from './profile.js';
import { AppConfig, RequestContext } from '../types.js';
import { getServiceClient } from '../supabase.js';

export type CustomAuthProvider = 'snapchat' | 'tiktok';
export type CustomAuthPlatform = 'web' | 'mobile' | 'desktop';

interface StartCustomAuthBody {
  clientRedirectUri?: string;
  platform?: CustomAuthPlatform;
}

interface SignedProviderState {
  provider: CustomAuthProvider;
  clientRedirectUri: string;
  platform: CustomAuthPlatform;
  issuedAt: number;
  nonce: string;
  codeVerifier: string;
}

interface ProviderIdentity {
  providerUserId: string;
  providerEmail: string | null;
  emailVerified: boolean;
  providerUsername: string | null;
  providerDisplayName: string | null;
  providerAvatarUrl: string | null;
  providerMetadata: Record<string, unknown>;
}

interface SupabaseSessionBootstrap {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  me: Awaited<ReturnType<typeof fetchMeAggregateForProfileId>>;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const SNAPCHAT_AUTHORIZE_URL = 'https://accounts.snapchat.com/accounts/oauth2/auth';
const SNAPCHAT_TOKEN_URL = 'https://accounts.snapchat.com/accounts/oauth2/token';
const SNAPCHAT_USER_INFO_URL = 'https://kit.snapchat.com/v1/me';
const SNAPCHAT_USER_INFO_QUERY =
  '{me{externalId,displayName,bitmoji{avatar}}}';

function assertSupportedProvider(value: string): CustomAuthProvider | null {
  return value === 'snapchat' || value === 'tiktok' ? value : null;
}

export function matchCustomAuthProvider(
  path: string,
): { provider: CustomAuthProvider; action: 'start' | 'callback' } | null {
  const match = path.match(/^\/v1\/auth\/providers\/([a-z]+)\/(start|callback)$/);
  if (!match) {
    return null;
  }

  const provider = assertSupportedProvider(match[1] ?? '');
  if (!provider) {
    return null;
  }

  return {
    provider,
    action: match[2] as 'start' | 'callback',
  };
}

function ensureAuthStateSecret(config: AppConfig): string {
  if (!config.authStateSecret) {
    throw new AppError(
      'provider_auth_not_configured',
      'AUTH_STATE_SECRET is required for custom provider auth flows',
      500,
    );
  }

  return config.authStateSecret;
}

function normalizePlatform(value: unknown): CustomAuthPlatform {
  if (value === 'mobile' || value === 'desktop' || value === 'web') {
    return value;
  }

  return 'mobile';
}

function assertClientRedirectUri(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError('validation_error', 'clientRedirectUri is required', 400);
  }

  const normalized = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new AppError('validation_error', 'clientRedirectUri must be a valid absolute URI', 400);
  }

  if (!parsed.protocol) {
    throw new AppError('validation_error', 'clientRedirectUri must include a URI scheme', 400);
  }

  return normalized;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signState(state: SignedProviderState, secret: string): string {
  const payload = base64UrlEncode(JSON.stringify(state));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSignedState(value: string, provider: CustomAuthProvider, secret: string): SignedProviderState {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) {
    throw new AppError('invalid_state', 'Provider auth state is invalid', 400);
  }

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new AppError('invalid_state', 'Provider auth state signature is invalid', 400);
  }

  let parsed: SignedProviderState;
  try {
    parsed = JSON.parse(base64UrlDecode(payload)) as SignedProviderState;
  } catch {
    throw new AppError('invalid_state', 'Provider auth state payload is invalid', 400);
  }

  if (parsed.provider !== provider) {
    throw new AppError('invalid_state', 'Provider auth state does not match callback provider', 400);
  }

  if (!parsed.clientRedirectUri || !parsed.codeVerifier || !parsed.issuedAt) {
    throw new AppError('invalid_state', 'Provider auth state is incomplete', 400);
  }

  if (Date.now() - parsed.issuedAt > STATE_TTL_MS) {
    throw new AppError('expired_state', 'Provider auth state has expired', 400);
  }

  return parsed;
}

function createCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

function createCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function getTikTokAuthorizeUrl(config: AppConfig, state: SignedProviderState): string {
  if (!config.tiktokClientKey || !config.tiktokRedirectUri) {
    throw new AppError(
      'provider_auth_not_configured',
      'TikTok auth requires TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI',
      500,
    );
  }

  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set('client_key', config.tiktokClientKey);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.tiktokScopes.join(','));
  url.searchParams.set('redirect_uri', config.tiktokRedirectUri);
  url.searchParams.set('state', signState(state, ensureAuthStateSecret(config)));
  url.searchParams.set('code_challenge', createCodeChallenge(state.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

function getSnapchatAuthorizeUrl(config: AppConfig, state: SignedProviderState): string {
  if (!config.snapchatClientId || !config.snapchatRedirectUri) {
    throw new AppError(
      'provider_auth_not_configured',
      'Snapchat auth requires SNAPCHAT_CLIENT_ID and SNAPCHAT_REDIRECT_URI',
      500,
    );
  }

  const url = new URL(SNAPCHAT_AUTHORIZE_URL);
  url.searchParams.set('client_id', config.snapchatClientId);
  url.searchParams.set('redirect_uri', config.snapchatRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.snapchatScopes.join(' '));
  url.searchParams.set('state', signState(state, ensureAuthStateSecret(config)));
  url.searchParams.set('code_challenge', createCodeChallenge(state.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

function buildClientRedirectUrl(
  baseUri: string,
  payload: Record<string, string | number | null | undefined>,
): string {
  const fragment = new URLSearchParams();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }
    fragment.set(key, String(value));
  }

  return `${baseUri}#${fragment.toString()}`;
}

function redirectToClient(response: ServerResponse, location: string): void {
  response.statusCode = 302;
  response.setHeader('location', location);
  response.end();
}

async function exchangeTikTokCode(
  code: string,
  state: SignedProviderState,
  config: AppConfig,
): Promise<Record<string, unknown>> {
  if (!config.tiktokClientKey || !config.tiktokClientSecret || !config.tiktokRedirectUri) {
    throw new AppError(
      'provider_auth_not_configured',
      'TikTok auth requires TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI',
      500,
    );
  }

  const body = new URLSearchParams({
    client_key: config.tiktokClientKey,
    client_secret: config.tiktokClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.tiktokRedirectUri,
  });

  if (state.platform !== 'web') {
    body.set('code_verifier', state.codeVerifier);
  }

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new AppError(
      'provider_token_exchange_failed',
      typeof data.error_description === 'string'
        ? data.error_description
        : 'TikTok token exchange failed',
      401,
      { provider: 'tiktok', providerError: data.error ?? null },
    );
  }

  return data;
}

async function fetchTikTokIdentity(accessToken: string, tokenData: Record<string, unknown>): Promise<ProviderIdentity> {
  const url = new URL(TIKTOK_USER_INFO_URL);
  url.searchParams.set('fields', 'open_id,union_id,avatar_url,display_name');

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const data = (await response.json()) as Record<string, unknown>;

  const error = (data.error ?? null) as Record<string, unknown> | null;
  const user =
    ((data.data ?? null) as { user?: Record<string, unknown> } | null)?.user ?? null;

  if (!response.ok || !user || (error && error.code !== 'ok')) {
    throw new AppError(
      'provider_profile_fetch_failed',
      typeof error?.message === 'string' && error.message.length > 0
        ? error.message
        : 'Failed to fetch TikTok user profile',
      401,
      { provider: 'tiktok', providerError: error?.code ?? null },
    );
  }

  const openId =
    typeof user.open_id === 'string' && user.open_id.length > 0
      ? user.open_id
      : typeof tokenData.open_id === 'string'
        ? tokenData.open_id
        : null;

  if (!openId) {
    throw new AppError('provider_profile_fetch_failed', 'TikTok did not return an open_id', 401);
  }

  return {
    providerUserId: openId,
    providerEmail: null,
    emailVerified: false,
    providerUsername: null,
    providerDisplayName:
      typeof user.display_name === 'string' ? user.display_name : null,
    providerAvatarUrl:
      typeof user.avatar_url === 'string' ? user.avatar_url : null,
    providerMetadata: {
      openId,
      unionId: typeof user.union_id === 'string' ? user.union_id : null,
      scope: typeof tokenData.scope === 'string' ? tokenData.scope : null,
      tokenType: typeof tokenData.token_type === 'string' ? tokenData.token_type : null,
    },
  };
}

async function exchangeSnapchatCode(
  code: string,
  state: SignedProviderState,
  config: AppConfig,
): Promise<Record<string, unknown>> {
  if (!config.snapchatClientId || !config.snapchatClientSecret || !config.snapchatRedirectUri) {
    throw new AppError(
      'provider_auth_not_configured',
      'Snapchat auth requires SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET, and SNAPCHAT_REDIRECT_URI',
      500,
    );
  }

  const body = new URLSearchParams({
    client_id: config.snapchatClientId,
    client_secret: config.snapchatClientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.snapchatRedirectUri,
    code_verifier: state.codeVerifier,
  });

  const response = await fetch(SNAPCHAT_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== 'string') {
    throw new AppError(
      'provider_token_exchange_failed',
      typeof data.error_description === 'string'
        ? data.error_description
        : 'Snapchat token exchange failed',
      401,
      { provider: 'snapchat', providerError: data.error ?? null },
    );
  }

  return data;
}

async function fetchSnapchatIdentity(
  accessToken: string,
  tokenData: Record<string, unknown>,
): Promise<ProviderIdentity> {
  const url = new URL(SNAPCHAT_USER_INFO_URL);
  url.searchParams.set('query', SNAPCHAT_USER_INFO_QUERY);

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const data = (await response.json()) as Record<string, unknown>;

  const me =
    ((data.data ?? null) as { me?: Record<string, unknown> } | null)?.me ?? null;
  const errors = Array.isArray(data.errors) ? (data.errors as Array<Record<string, unknown>>) : [];

  if (!response.ok || !me) {
    const firstError = errors[0];
    const errorMessage =
      typeof firstError?.message === 'string'
        ? firstError.message
        : 'Failed to fetch Snapchat user profile';

    throw new AppError('provider_profile_fetch_failed', errorMessage, 401, {
      provider: 'snapchat',
      providerError: firstError?.extensions ?? null,
    });
  }

  const externalId = typeof me.externalId === 'string' ? me.externalId : null;
  if (!externalId) {
    throw new AppError(
      'provider_profile_fetch_failed',
      'Snapchat did not return an externalId',
      401,
      { provider: 'snapchat' },
    );
  }

  const bitmoji = (me.bitmoji ?? null) as { avatar?: unknown } | null;
  const avatarUrl = typeof bitmoji?.avatar === 'string' ? bitmoji.avatar : null;

  return {
    providerUserId: externalId,
    providerEmail: null,
    emailVerified: false,
    providerUsername: null,
    providerDisplayName: typeof me.displayName === 'string' ? me.displayName : null,
    providerAvatarUrl: avatarUrl,
    providerMetadata: {
      externalId,
      scope: typeof tokenData.scope === 'string' ? tokenData.scope : null,
      tokenType: typeof tokenData.token_type === 'string' ? tokenData.token_type : null,
    },
  };
}

async function resolveProviderIdentity(
  provider: CustomAuthProvider,
  state: SignedProviderState,
  config: AppConfig,
  code: string,
): Promise<{ identity: ProviderIdentity; tokenData: Record<string, unknown> }> {
  if (provider === 'tiktok') {
    const tokenData = await exchangeTikTokCode(code, state, config);
    const identity = await fetchTikTokIdentity(String(tokenData.access_token), tokenData);
    return { identity, tokenData };
  }

  const tokenData = await exchangeSnapchatCode(code, state, config);
  const identity = await fetchSnapchatIdentity(String(tokenData.access_token), tokenData);
  return { identity, tokenData };
}

function deriveSyntheticEmail(provider: CustomAuthProvider, providerUserId: string): string {
  const normalized = providerUserId.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  const suffix = normalized.length > 48 ? normalized.slice(0, 48) : normalized;
  return `${provider}-${suffix || 'user'}@users.hinto.invalid`;
}

async function findProfileIdByVerifiedEmail(email: string, config: AppConfig): Promise<string | null> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return typeof data[0]?.id === 'string' ? data[0].id : null;
}

async function ensureAuthUserForIdentity(
  provider: CustomAuthProvider,
  identity: ProviderIdentity,
  config: AppConfig,
): Promise<{ userId: string; email: string }> {
  const supabase = getServiceClient(config);

  const { data: existingIdentity, error: identityError } = await supabase
    .from('auth_identities')
    .select('user_id')
    .eq('provider', provider)
    .eq('provider_user_id', identity.providerUserId)
    .maybeSingle();

  if (identityError) {
    throw new AppError('identity_lookup_failed', 'Failed to look up existing provider identity', 500);
  }

  if (existingIdentity?.user_id) {
    const { data, error } = await supabase.auth.admin.getUserById(existingIdentity.user_id);
    if (error || !data.user?.email) {
      throw new AppError(
        'auth_user_lookup_failed',
        'Found linked provider identity, but could not resolve the auth user',
        500,
      );
    }

    return {
      userId: existingIdentity.user_id,
      email: data.user.email,
    };
  }

  if (identity.providerEmail && identity.emailVerified) {
    const existingProfileId = await findProfileIdByVerifiedEmail(identity.providerEmail, config);
    if (existingProfileId) {
      return {
        userId: existingProfileId,
        email: identity.providerEmail,
      };
    }
  }

  const email = identity.providerEmail && identity.emailVerified
    ? identity.providerEmail
    : deriveSyntheticEmail(provider, identity.providerUserId);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: identity.providerDisplayName,
      avatar_url: identity.providerAvatarUrl,
      provider,
    },
  });

  if (error || !data.user?.id || !data.user.email) {
    throw new AppError(
      'auth_user_create_failed',
      error?.message ?? 'Failed to create auth user for provider identity',
      500,
    );
  }

  return {
    userId: data.user.id,
    email: data.user.email,
  };
}

async function upsertIdentityAndProfile(
  provider: CustomAuthProvider,
  userId: string,
  identity: ProviderIdentity,
  config: AppConfig,
): Promise<void> {
  const supabase = getServiceClient(config);

  const { data: profileRow, error: profileLookupError } = await supabase
    .from('profiles')
    .select('name, avatar_url, email')
    .eq('id', userId)
    .single();

  if (profileLookupError || !profileRow) {
    throw new AppError('profile_not_found', 'Failed to look up profile for provider linkage', 404);
  }

  const profileUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (!profileRow.name && identity.providerDisplayName) {
    profileUpdates.name = identity.providerDisplayName;
  }
  if (!profileRow.avatar_url && identity.providerAvatarUrl) {
    profileUpdates.avatar_url = identity.providerAvatarUrl;
  }
  if (!profileRow.email && identity.emailVerified && identity.providerEmail) {
    profileUpdates.email = identity.providerEmail;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId);

  if (profileError) {
    throw new AppError('profile_update_failed', 'Failed to update profile from provider data', 500);
  }

  const { error: identityError } = await supabase
    .from('auth_identities')
    .upsert({
      user_id: userId,
      provider,
      provider_user_id: identity.providerUserId,
      provider_email: identity.providerEmail,
      provider_username: identity.providerUsername,
      provider_display_name: identity.providerDisplayName,
      provider_avatar_url: identity.providerAvatarUrl,
      provider_metadata: identity.providerMetadata,
      last_used_at: new Date().toISOString(),
      is_primary: false,
    }, {
      onConflict: 'provider,provider_user_id',
    });

  if (identityError) {
    throw new AppError('identity_upsert_failed', 'Failed to store provider identity linkage', 500);
  }
}

async function bootstrapSupabaseSession(
  userId: string,
  email: string,
  config: AppConfig,
): Promise<SupabaseSessionBootstrap> {
  const supabase = getServiceClient(config);
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    throw new AppError(
      'session_bootstrap_failed',
      linkError?.message ?? 'Failed to generate Supabase session bootstrap link',
      500,
    );
  }

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyError || !verifyData.session) {
    throw new AppError(
      'session_bootstrap_failed',
      verifyError?.message ?? 'Failed to verify Supabase session bootstrap token',
      500,
    );
  }

  const me = await fetchMeAggregateForProfileId(userId, userId, config);

  return {
    accessToken: verifyData.session.access_token,
    refreshToken: verifyData.session.refresh_token,
    expiresAt: verifyData.session.expires_at ?? null,
    me,
  };
}

async function logAuthEvent(
  provider: CustomAuthProvider,
  success: boolean,
  config: AppConfig,
  details: {
    userId?: string | null;
    eventType: string;
    request?: IncomingMessage;
    errorCode?: string;
    errorDetail?: string;
  },
): Promise<void> {
  const supabase = getServiceClient(config);
  await supabase.from('auth_login_events').insert({
    user_id: details.userId ?? null,
    provider,
    event_type: details.eventType,
    success,
    user_agent: details.request?.headers['user-agent'] ?? null,
    error_code: details.errorCode ?? null,
    error_detail: details.errorDetail ?? null,
  });
}

export async function handleCustomProviderStart(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  provider: CustomAuthProvider,
): Promise<void> {
  ensureAuthStateSecret(config);

  const body = (await readJsonBody(request)) as StartCustomAuthBody;
  const clientRedirectUri = assertClientRedirectUri(body.clientRedirectUri);
  const platform = normalizePlatform(body.platform);
  const state: SignedProviderState = {
    provider,
    clientRedirectUri,
    platform,
    issuedAt: Date.now(),
    nonce: randomBytes(12).toString('hex'),
    codeVerifier: createCodeVerifier(),
  };

  const authorizationUrl =
    provider === 'tiktok'
      ? getTikTokAuthorizeUrl(config, state)
      : getSnapchatAuthorizeUrl(config, state);

  sendJsonSuccess(response, 200, context.requestId, {
    provider,
    authorizationUrl,
    expiresAt: new Date(state.issuedAt + STATE_TTL_MS).toISOString(),
    platform,
  });
}

export async function handleCustomProviderCallback(
  request: IncomingMessage,
  response: ServerResponse,
  _context: RequestContext,
  config: AppConfig,
  provider: CustomAuthProvider,
): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? config.host}`);
  const stateParam = url.searchParams.get('state');

  if (!stateParam) {
    throw new AppError('invalid_state', 'Missing provider auth state', 400);
  }

  const state = readSignedState(stateParam, provider, ensureAuthStateSecret(config));

  const providerError = url.searchParams.get('error');
  if (providerError) {
    const providerErrorDescription = url.searchParams.get('error_description') ?? 'Provider authorization failed';
    await logAuthEvent(provider, false, config, {
      eventType: 'oauth_callback_error',
      request,
      errorCode: providerError,
      errorDetail: providerErrorDescription,
    });

    redirectToClient(
      response,
      buildClientRedirectUrl(state.clientRedirectUri, {
        provider,
        error: providerError,
        errorDescription: providerErrorDescription,
      }),
    );
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    throw new AppError('provider_code_missing', 'Missing authorization code from provider callback', 400);
  }

  try {
    const { identity } = await resolveProviderIdentity(provider, state, config, code);
    const { userId, email } = await ensureAuthUserForIdentity(provider, identity, config);
    await upsertIdentityAndProfile(provider, userId, identity, config);
    const session = await bootstrapSupabaseSession(userId, email, config);

    await logAuthEvent(provider, true, config, {
      userId,
      eventType: 'login_succeeded',
      request,
    });

    redirectToClient(
      response,
      buildClientRedirectUrl(state.clientRedirectUri, {
        provider,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      }),
    );
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError('provider_callback_failed', 'Provider callback failed', 500);

    await logAuthEvent(provider, false, config, {
      eventType: 'login_failed',
      request,
      errorCode: appError.code,
      errorDetail: appError.message,
    });

    redirectToClient(
      response,
      buildClientRedirectUrl(state.clientRedirectUri, {
        provider,
        error: appError.code,
        errorDescription: appError.message,
      }),
    );
  }
}

export const testExports = {
  buildClientRedirectUrl,
  deriveSyntheticEmail,
  readSignedState,
  signState,
};
