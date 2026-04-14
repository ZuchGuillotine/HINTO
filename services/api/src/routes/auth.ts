import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { readJsonBody } from '../body.js';
import { getServiceClient } from '../supabase.js';
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
  config: AppConfig,
): Promise<void> {
  const body = await readJsonBody(request);
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }

  const supabase = getServiceClient(config);
  const { error } = await supabase.auth.signInWithOtp({ email });

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

  if (!email || !EMAIL_RE.test(email)) {
    throw new AppError('validation_error', 'A valid email address is required', 400);
  }
  if (!token) {
    throw new AppError('validation_error', 'Verification code is required', 400);
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
