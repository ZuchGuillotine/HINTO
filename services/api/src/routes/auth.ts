import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { readJsonBody } from '../body.js';
import { verifyAppleIdentityToken } from '../apple.js';
import { shouldUsePostgres } from '../db.js';
import {
  assertPasswordAllowed,
  authenticateEmailPassword,
  createOrLoadAppleAccount,
  createEmailPasswordAccount,
  createPostgresAuthSession,
  refreshPostgresAuthSession,
} from '../repositories/postgres-auth.js';
import { getServiceClient } from '../supabase.js';
import { fetchMeAggregateForProfileId } from './profile.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
type EmailAuthIntent = 'sign_in' | 'sign_up';

function parseEmailAuthIntent(value: unknown): EmailAuthIntent {
  return value === 'sign_up' ? 'sign_up' : 'sign_in';
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function assertDevelopmentEmailAuthEnabled(config: AppConfig): void {
  if (config.nodeEnv === 'production' || !config.developmentAuthEnabled) {
    throw new AppError(
      'development_auth_disabled',
      'Email OTP delivery bypass requires ENABLE_DEVELOPMENT_AUTH=true outside production',
      403,
    );
  }
}

function usernameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'user';
  return (
    localPart
      .toLowerCase()
      .replace(/[^a-z0-9_]+/gu, '_')
      .replace(/_{2,}/gu, '_')
      .replace(/^_|_$/gu, '') || 'user'
  );
}

function assertRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError('validation_error', `${fieldName} is required`, 400);
  }

  return value.trim();
}

async function ensureEmailIdentity(
  userId: string,
  email: string,
  config: AppConfig,
): Promise<void> {
  const supabase = getServiceClient(config);
  const { data: primaryIdentities, error: primaryLookupError } = await supabase
    .from('auth_identities')
    .select('provider')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .limit(1);

  if (primaryLookupError) {
    throw new AppError(
      'identity_lookup_failed',
      `Failed to inspect existing auth identities: ${primaryLookupError.message}`,
      500,
    );
  }

  const hasPrimaryIdentity =
    Array.isArray(primaryIdentities) && primaryIdentities.length > 0;

  const { error } = await supabase
    .from('auth_identities')
    .upsert(
      {
        user_id: userId,
        provider: 'email',
        provider_user_id: userId,
        provider_email: email,
        is_primary: !hasPrimaryIdentity,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );

  if (error) {
    throw new AppError(
      'identity_link_failed',
      `Failed to link email auth identity: ${error.message}`,
      500,
    );
  }
}

async function findProfileIdByEmail(email: string, config: AppConfig): Promise<string | null> {
  const supabase = getServiceClient(config);
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileLookupError) {
    throw new AppError('profile_lookup_failed', 'Failed to load email profile', 500);
  }

  return (existingProfile as { id: string } | null)?.id ?? null;
}

async function assertEmailIntentAllowed(
  intent: EmailAuthIntent,
  email: string,
  config: AppConfig,
): Promise<void> {
  const profileId = await findProfileIdByEmail(email, config);

  if (intent === 'sign_in' && !profileId) {
    throw new AppError(
      'account_not_found',
      'No HINTO account exists for this email. Use sign up first.',
      404,
    );
  }

  if (intent === 'sign_up' && profileId) {
    throw new AppError(
      'account_exists',
      'A HINTO account already exists for this email. Use sign in instead.',
      409,
    );
  }
}

async function createOrLoadEmailDevSessionForIntent(
  email: string,
  intent: EmailAuthIntent,
  config: AppConfig,
  profileInput: {
    username?: string | null;
    displayName?: string | null;
  } = {},
) {
  const supabase = getServiceClient(config);
  const now = new Date().toISOString();

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileLookupError) {
    throw new AppError('profile_lookup_failed', 'Failed to load email test profile', 500);
  }

  let profileId = (existingProfile as { id: string } | null)?.id;

  if (intent === 'sign_in' && !profileId) {
    throw new AppError(
      'account_not_found',
      'No HINTO account exists for this email. Use sign up first.',
      404,
    );
  }

  if (intent === 'sign_up' && profileId) {
    throw new AppError(
      'account_exists',
      'A HINTO account already exists for this email. Use sign in instead.',
      409,
    );
  }

  if (!profileId) {
    const username = profileInput.username ?? usernameFromEmail(email);
    const displayName =
      profileInput.displayName ??
      username
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        dev: true,
        email_auth_bypass: true,
        username,
        display_name: displayName,
      },
    });

    if (authError || !authUser.user) {
      throw new AppError(
        'email_test_session_failed',
        `Failed to create email test user: ${authError?.message}`,
        500,
      );
    }

    profileId = authUser.user.id;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        name: displayName,
        email,
        is_public: false,
        mutuals_only: false,
        updated_at: now,
      })
      .eq('id', profileId);

    if (updateError) {
      throw new AppError(
        'email_test_session_failed',
        'Failed to update email test profile',
        500,
      );
    }
  }

  await ensureEmailIdentity(profileId, email, config);
  const me = await fetchMeAggregateForProfileId(profileId, profileId, config);

  return {
    accessToken: `dev-session:${profileId}`,
    refreshToken: `dev-refresh:${profileId}`,
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    me,
    developmentBypass: true,
  };
}

/**
 * POST /v1/auth/email/otp
 * Sends a one-time verification code to the given email address.
 * Creates the user in Supabase Auth if they don't exist yet.
 */
export async function handleEmailOtp(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const body = await readJsonBody(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const intent = parseEmailAuthIntent(body.intent);
  const username = normalizeOptionalString(body.username);
  const displayName = normalizeOptionalString(body.displayName);

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }
  if (intent === 'sign_up' && (!username || !displayName)) {
    throw new AppError(
      'validation_error',
      'username and displayName are required for sign up',
      400,
    );
  }
  await assertEmailIntentAllowed(intent, email, config);

  if (config.emailOtpDeliveryDisabled) {
    assertDevelopmentEmailAuthEnabled(config);
    sendJsonSuccess(response, 200, context.requestId, {
      sent: true,
      email,
      deliveryDisabled: true,
      developmentCode: 'any',
    });
    return;
  }

  const supabase = getServiceClient(config);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: intent === 'sign_up',
      data: {
        username: username ?? usernameFromEmail(email),
        display_name: displayName ?? username ?? usernameFromEmail(email),
      },
    },
  });

  if (error) {
    throw new AppError(
      'otp_send_failed',
      `Failed to send verification code: ${error.message}`,
      500,
    );
  }

  sendJsonSuccess(response, 200, context.requestId, { sent: true, email });
}

/**
 * POST /v1/auth/email/verify
 * Verifies the OTP code and returns a full session (access + refresh tokens)
 * plus the user's MeAggregate.
 */
export async function handleEmailVerify(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const body = await readJsonBody(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const intent = parseEmailAuthIntent(body.intent);
  const username = normalizeOptionalString(body.username);
  const displayName = normalizeOptionalString(body.displayName);

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }
  if (!token) {
    throw new AppError('validation_error', 'Verification code is required', 400);
  }
  if (intent === 'sign_up' && (!username || !displayName)) {
    throw new AppError(
      'validation_error',
      'username and displayName are required for sign up',
      400,
    );
  }

  if (config.emailOtpDeliveryDisabled) {
    assertDevelopmentEmailAuthEnabled(config);
    const session = await createOrLoadEmailDevSessionForIntent(email, intent, config, {
      username,
      displayName,
    });
    sendJsonSuccess(response, 200, context.requestId, session);
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error || !data.session || !data.user) {
    throw new AppError(
      'verification_failed',
      error?.message ?? 'Invalid or expired verification code',
      401,
    );
  }

  await ensureEmailIdentity(data.user.id, email, config);

  if (intent === 'sign_up') {
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        username,
        name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.user.id);

    if (profileUpdateError) {
      throw new AppError(
        'profile_update_failed',
        'Failed to complete signup profile',
        500,
      );
    }
  }

  // The handle_new_user trigger auto-creates the profile row.
  const me = await fetchMeAggregateForProfileId(
    data.user.id,
    data.user.id,
    config,
  );

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    me,
  });
}

export async function handleEmailPasswordSignUp(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  if (!shouldUsePostgres(config)) {
    throw new AppError(
      'password_auth_unavailable',
      'Email/password auth requires the AWS Postgres API backend',
      501,
    );
  }

  const body = await readJsonBody(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = assertPasswordAllowed(body.password);
  const username = assertRequiredString(body.username, 'username');
  const displayName = assertRequiredString(body.displayName, 'displayName');

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }

  const authProfile = await createEmailPasswordAccount(config, {
    email,
    password,
    username,
    displayName,
  });
  const session = await createPostgresAuthSession(config, request, authProfile);
  const me = await fetchMeAggregateForProfileId(
    session.profileId,
    session.platformUserId,
    config,
  );

  sendJsonSuccess(response, 201, context.requestId, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    me,
  });
}

export async function handleEmailPasswordSignIn(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  if (!shouldUsePostgres(config)) {
    throw new AppError(
      'password_auth_unavailable',
      'Email/password auth requires the AWS Postgres API backend',
      501,
    );
  }

  const body = await readJsonBody(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = assertPasswordAllowed(body.password);

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }

  const authProfile = await authenticateEmailPassword(config, { email, password });
  const session = await createPostgresAuthSession(config, request, authProfile);
  const me = await fetchMeAggregateForProfileId(
    session.profileId,
    session.platformUserId,
    config,
  );

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    me,
  });
}

export async function handleNativeAppleSignIn(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  if (!shouldUsePostgres(config)) {
    throw new AppError(
      'apple_auth_unavailable',
      'Apple auth requires the AWS Postgres API backend',
      501,
    );
  }

  const body = await readJsonBody(request);
  const identityToken = assertRequiredString(body.identityToken, 'identityToken');
  const displayName = normalizeOptionalString(body.displayName);
  const claims = await verifyAppleIdentityToken(
    identityToken,
    config.appleClientId ?? 'app.hnnt',
  );
  const email =
    typeof body.email === 'string' && EMAIL_RE.test(body.email)
      ? body.email.trim().toLowerCase()
      : claims.email ?? null;

  const authProfile = await createOrLoadAppleAccount(config, {
    appleUserId: claims.sub,
    email,
    displayName,
  });
  const session = await createPostgresAuthSession(config, request, authProfile);
  const me = await fetchMeAggregateForProfileId(
    session.profileId,
    session.platformUserId,
    config,
  );

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    me,
  });
}

/**
 * POST /v1/auth/refresh
 * Exchanges a refresh token for a new access + refresh token pair.
 */
export async function handleRefreshToken(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const body = await readJsonBody(request);
  const refreshToken =
    typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';

  if (!refreshToken) {
    throw new AppError('validation_error', 'refreshToken is required', 400);
  }

  if (shouldUsePostgres(config)) {
    const session = await refreshPostgresAuthSession(config, request, refreshToken);
    if (!session) {
      throw new AppError('refresh_failed', 'Invalid or expired refresh token', 401);
    }

    const me = await fetchMeAggregateForProfileId(
      session.profileId,
      session.platformUserId,
      config,
    );

    sendJsonSuccess(response, 200, context.requestId, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      me,
    });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new AppError(
      'refresh_failed',
      error?.message ?? 'Failed to refresh session',
      401,
    );
  }

  const me = await fetchMeAggregateForProfileId(
    data.user.id,
    data.user.id,
    config,
  );

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    me,
  });
}
