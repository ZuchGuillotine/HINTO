import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';
import { isAiCoachEnabled } from './ai.js';

const MIN_AGE = 16;
const MAX_AGE = 120;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/u;

export interface ProfileRow {
  id: string;
  username: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  is_public: boolean;
  mutuals_only: boolean;
  subscription_tier: string | null;
  bio?: string | null;
  age: number | null;
  age_verified: boolean;
  profile_image_id: string | null;
  created_at: string;
  updated_at: string;
}

function derivePrivacy(
  isPublic: boolean,
  mutualsOnly: boolean
): 'public' | 'private' | 'mutuals_only' {
  if (mutualsOnly) return 'mutuals_only';
  if (isPublic) return 'public';
  return 'private';
}

function normalizeTier(value: string | null): 'free' | 'premium' | 'unknown' {
  if (value === 'free' || value === 'premium') {
    return value;
  }
  return 'free';
}

export function toProfileDto(row: ProfileRow) {
  return {
    profileId: row.id,
    username: row.username ?? row.id,
    displayName: row.name ?? '',
    email: row.email,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url,
    privacy: derivePrivacy(row.is_public, row.mutuals_only),
    subscriptionTier: normalizeTier(row.subscription_tier),
    age: row.age ?? null,
    ageVerified: Boolean(row.age_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface MeAggregate {
  profile: ReturnType<typeof toProfileDto>;
  auth: {
    authUserId: string;
    profileId: string;
    primaryProvider: string | null;
    linkedProviders: string[];
    status: 'active' | 'pending' | 'disabled';
  };
  capabilities: {
    canEditProfile: boolean;
    canCreateSituationship: boolean;
    canUseAiCoach: boolean;
  };
}

export function buildMeAggregate(
  row: ProfileRow,
  auth: { authUserId: string; profileId: string },
  config?: AppConfig
): MeAggregate {
  const profile = toProfileDto(row);

  return {
    profile,
    auth: {
      authUserId: auth.authUserId,
      profileId: auth.profileId,
      primaryProvider: null,
      linkedProviders: [],
      status: 'active',
    },
    capabilities: {
      canEditProfile: true,
      canCreateSituationship: true,
      canUseAiCoach: config ? isAiCoachEnabled(config) : false,
    },
  };
}

export async function fetchMeAggregateForProfileId(
  profileId: string,
  authUserId: string,
  config: AppConfig
): Promise<MeAggregate> {
  const supabase = getServiceClient(config);
  const { data: row, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error || !row) {
    throw new AppError('profile_not_found', 'Profile not found', 404);
  }

  const aggregate = buildMeAggregate(row as ProfileRow, { authUserId, profileId }, config);
  const { data: identities } = await supabase
    .from('auth_identities')
    .select('provider, is_primary')
    .eq('user_id', profileId);

  if (identities && identities.length > 0) {
    aggregate.auth.linkedProviders = identities.map(
      (identity: { provider: string }) => identity.provider
    );
    const primary = identities.find((identity: { is_primary: boolean }) => identity.is_primary);
    if (primary) {
      aggregate.auth.primaryProvider = (primary as { provider: string }).provider;
    }
  }

  return aggregate;
}

/**
 * GET /v1/me - Returns the current user's profile aggregate.
 */
export async function handleGetMe(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const aggregate = await fetchMeAggregateForProfileId(
    authCtx.user.profileId,
    authCtx.user.authUserId,
    config
  );
  sendJsonSuccess(response, 200, context.requestId, aggregate);
}

/**
 * PATCH /v1/me - Updates the current user's profile.
 */
export async function handlePatchMe(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);

  const updateFields: Record<string, unknown> = {};

  if (body.username !== undefined) {
    if (typeof body.username !== 'string' || (body.username as string).trim().length === 0) {
      throw new AppError('validation_error', 'username must be a non-empty string', 400);
    }
    updateFields.username = (body.username as string).trim().toLowerCase();
  }
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
      throw new AppError('validation_error', 'displayName must be a non-empty string', 400);
    }
    if (body.displayName.trim().length > 80) {
      throw new AppError('validation_error', 'displayName must be at most 80 characters', 400);
    }
    updateFields.name = body.displayName.trim();
  }
  if (body.bio !== undefined) {
    if (body.bio === null || (typeof body.bio === 'string' && body.bio.trim().length === 0)) {
      updateFields.bio = null;
    } else if (typeof body.bio !== 'string') {
      throw new AppError('validation_error', 'bio must be a string', 400);
    } else if (body.bio.trim().length > 300) {
      throw new AppError('validation_error', 'bio must be at most 300 characters', 400);
    } else {
      updateFields.bio = body.bio.trim();
    }
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl === null) {
      updateFields.avatar_url = null;
    } else if (typeof body.avatarUrl !== 'string' || !HTTPS_URL_RE.test(body.avatarUrl)) {
      throw new AppError('validation_error', 'avatarUrl must be an https URL', 400);
    } else {
      updateFields.avatar_url = body.avatarUrl;
    }
  }
  if (body.age !== undefined) {
    if (typeof body.age !== 'number' || !Number.isInteger(body.age)) {
      throw new AppError('validation_error', 'age must be an integer', 400);
    }
    if (body.age < MIN_AGE) {
      throw new AppError(
        'age_requirement_not_met',
        `You must be at least ${MIN_AGE} to use HINTO`,
        403
      );
    }
    if (body.age > MAX_AGE) {
      throw new AppError('validation_error', 'age is out of range', 400);
    }
    updateFields.age = body.age;
    updateFields.age_verified = true;
  }
  if (body.privacy !== undefined) {
    const validPrivacy = ['public', 'private', 'mutuals_only'];
    if (!validPrivacy.includes(body.privacy as string)) {
      throw new AppError('validation_error', `Invalid privacy value: ${body.privacy}`, 400);
    }
    if (body.privacy === 'public') {
      updateFields.is_public = true;
      updateFields.mutuals_only = false;
    } else if (body.privacy === 'mutuals_only') {
      updateFields.is_public = false;
      updateFields.mutuals_only = true;
    } else {
      updateFields.is_public = false;
      updateFields.mutuals_only = false;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    throw new AppError('validation_error', 'No valid fields to update', 400);
  }

  updateFields.updated_at = new Date().toISOString();

  const supabase = getServiceClient(config);

  const { data: row, error } = await supabase
    .from('profiles')
    .update(updateFields)
    .eq('id', authCtx.user.profileId)
    .select('*')
    .single();

  if (error || !row) {
    const pg = (error ?? {}) as { code?: string };
    if (pg.code === '23505') {
      throw new AppError('username_taken', 'That username is already taken', 409);
    }
    throw new AppError('update_failed', 'Failed to update profile', 500);
  }

  const aggregate = await fetchMeAggregateForProfileId(
    authCtx.user.profileId,
    authCtx.user.authUserId,
    config
  );
  sendJsonSuccess(response, 200, context.requestId, aggregate);
}

/**
 * DELETE /v1/me - Permanently deletes the account.
 * Removing the auth user cascades to profiles and every owned row
 * (situationships, voting sessions, votes, AI conversations, blocks, reports).
 * Required by App Store Review Guideline 5.1.1(v) and Meta data-deletion rules.
 */
export async function handleDeleteMe(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  // Log the deletion before the row disappears so support can answer
  // "did my account get deleted" questions.
  await supabase.from('auth_login_events').insert({
    user_id: authCtx.user.profileId,
    provider: 'account',
    event_type: 'account_deleted',
    success: true,
  });

  const { error } = await supabase.auth.admin.deleteUser(authCtx.user.authUserId);
  if (error) {
    // Development sessions have a profile but no auth user; still remove the profile.
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', authCtx.user.profileId);
    if (profileError) {
      throw new AppError('delete_failed', 'Failed to delete account', 500);
    }
  }

  sendJsonSuccess(response, 200, context.requestId, {
    deleted: true,
    profileId: authCtx.user.profileId,
  });
}
