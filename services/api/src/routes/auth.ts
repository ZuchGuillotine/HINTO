import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { readJsonBody } from '../body.js';
import { getAuthClient, getServiceClient } from '../supabase.js';
import { fetchMeAggregateForProfileId } from './profile.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * POST /v1/auth/email/otp
 * Sends a one-time verification code to the given email address.
 * Creates the user in Supabase Auth if they don't exist yet.
 */
export async function handleEmailOtp(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }

  const supabase = getAuthClient(config);
  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    throw new AppError(
      'otp_send_failed',
      `Failed to send verification code: ${error.message}`,
      500
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
  config: AppConfig
): Promise<void> {
  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }
  if (!token) {
    throw new AppError('validation_error', 'Verification code is required', 400);
  }

  const supabase = getAuthClient(config);
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error || !data.session || !data.user) {
    throw new AppError(
      'verification_failed',
      error?.message ?? 'Invalid or expired verification code',
      401
    );
  }

  // The handle_new_user trigger auto-creates the profile row.
  const me = await fetchMeAggregateForProfileId(data.user.id, data.user.id, config);

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
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
  config: AppConfig
): Promise<void> {
  const body = await readJsonBody(request);
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';

  if (!refreshToken) {
    throw new AppError('validation_error', 'refreshToken is required', 400);
  }

  const supabase = getAuthClient(config);
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session || !data.user) {
    throw new AppError('refresh_failed', error?.message ?? 'Failed to refresh session', 401);
  }

  const me = await fetchMeAggregateForProfileId(data.user.id, data.user.id, config);

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    me,
  });
}

/**
 * POST /v1/auth/apple
 * Exchanges an Apple identity token (from ASAuthorizationAppleIDCredential or
 * Apple JS) for a Supabase session. Supabase validates the token signature and
 * audience against the Apple provider configuration on the project.
 */
export async function handleAppleSignIn(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const body = await readJsonBody(request);
  const identityToken = typeof body.identityToken === 'string' ? body.identityToken.trim() : '';
  const nonce = typeof body.nonce === 'string' && body.nonce.trim() ? body.nonce.trim() : undefined;

  if (!identityToken) {
    throw new AppError('validation_error', 'identityToken is required', 400);
  }

  const supabase = getAuthClient(config);
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
    nonce,
  });

  if (error || !data.session || !data.user) {
    throw new AppError(
      'apple_sign_in_failed',
      error?.message ?? 'Apple identity token was rejected',
      401
    );
  }

  const fullName = body.fullName as
    | { givenName?: unknown; familyName?: unknown }
    | null
    | undefined;
  const seededName = [fullName?.givenName, fullName?.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map(part => part.trim())
    .join(' ');

  await recordProviderIdentity(config, {
    userId: data.user.id,
    provider: 'apple',
    providerUserId: data.user.id,
    providerEmail: data.user.email ?? null,
    providerDisplayName: seededName || null,
    seedProfileName: seededName || null,
  });

  const me = await fetchMeAggregateForProfileId(data.user.id, data.user.id, config);

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at ?? null,
    me,
  });
}

interface ProviderIdentityRecord {
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail: string | null;
  providerDisplayName: string | null;
  /** Used to seed `profiles.name` when the trigger left it empty. */
  seedProfileName: string | null;
}

/**
 * Upserts a row in `auth_identities` for a Supabase-managed provider so the
 * MeAggregate reports linked providers consistently across Apple/email/custom
 * flows. Failures are logged through the error envelope but never block sign-in.
 */
async function recordProviderIdentity(
  config: AppConfig,
  record: ProviderIdentityRecord
): Promise<void> {
  const supabase = getServiceClient(config);
  const now = new Date().toISOString();

  try {
    await supabase.from('auth_identities').upsert(
      {
        user_id: record.userId,
        provider: record.provider,
        provider_user_id: record.providerUserId,
        provider_email: record.providerEmail,
        provider_display_name: record.providerDisplayName,
        last_used_at: now,
        updated_at: now,
      },
      { onConflict: 'provider,provider_user_id' }
    );

    if (record.seedProfileName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', record.userId)
        .maybeSingle();

      const currentName = (profile as { name?: string | null } | null)?.name ?? '';
      const emailLocalPart = record.providerEmail?.split('@')[0] ?? '';
      const isPlaceholderName =
        !currentName.trim() ||
        currentName === record.providerEmail ||
        (emailLocalPart.length > 0 && currentName === emailLocalPart);
      if (isPlaceholderName) {
        await supabase
          .from('profiles')
          .update({ name: record.seedProfileName, updated_at: now })
          .eq('id', record.userId);
      }
    }
  } catch {
    // Identity bookkeeping must never fail the sign-in itself.
  }
}
