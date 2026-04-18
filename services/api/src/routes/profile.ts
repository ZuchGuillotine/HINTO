import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';

export interface ProfileRow {
  id: string;
  username: string | null;
  name: string | null;
  display_name?: string | null;
  email: string | null;
  bio?: string | null;
  avatar_url: string | null;
  privacy?: string | null;
  is_public?: boolean | null;
  mutuals_only?: boolean | null;
  subscription_tier: string | null;
  age: number | null;
  age_verified?: boolean | null;
  profile_image_id: string | null;
  created_at: string;
  updated_at: string;
}

function derivePrivacy(row: Pick<ProfileRow, 'privacy' | 'is_public' | 'mutuals_only'>): 'public' | 'private' | 'mutuals_only' {
  if (row.privacy === 'public' || row.privacy === 'private' || row.privacy === 'mutuals_only') {
    return row.privacy;
  }

  if (row.mutuals_only) return 'mutuals_only';
  if (row.is_public) return 'public';
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
    displayName: row.name ?? row.display_name ?? '',
    email: row.email,
    bio: row.bio ?? null,
    avatarUrl: row.avatar_url,
    privacy: derivePrivacy(row),
    subscriptionTier: normalizeTier(row.subscription_tier),
    age: row.age,
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
      canUseAiCoach: false,
    },
  };
}

export async function fetchMeAggregateForProfileId(
  profileId: string,
  authUserId: string,
  config: AppConfig,
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

  const aggregate = buildMeAggregate(row as ProfileRow, { authUserId, profileId });
  const { data: identities } = await supabase
    .from('auth_identities')
    .select('provider, is_primary')
    .eq('user_id', profileId);

  if (identities && identities.length > 0) {
    aggregate.auth.linkedProviders = identities.map((identity: { provider: string }) => identity.provider);
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
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const aggregate = await fetchMeAggregateForProfileId(
    authCtx.user.profileId,
    authCtx.user.authUserId,
    config,
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
  config: AppConfig,
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
    if (typeof body.displayName !== 'string') {
      throw new AppError('validation_error', 'displayName must be a string', 400);
    }
    updateFields.name = body.displayName;
  }
  if (body.bio !== undefined) {
    if (body.bio !== null && typeof body.bio !== 'string') {
      throw new AppError('validation_error', 'bio must be a string or null', 400);
    }
    updateFields.bio = body.bio;
  }
  if (body.avatarUrl !== undefined) {
    updateFields.avatar_url = body.avatarUrl;
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
    throw new AppError('update_failed', 'Failed to update profile', 500);
  }

  const aggregate = await fetchMeAggregateForProfileId(
    authCtx.user.profileId,
    authCtx.user.authUserId,
    config,
  );
  sendJsonSuccess(response, 200, context.requestId, aggregate);
}
