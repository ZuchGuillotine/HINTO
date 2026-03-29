import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser, AuthenticatedContext } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  privacy: string | null;
  subscription_tier: string | null;
  created_at: string;
  updated_at: string;
}

function normalizePrivacy(value: string | null): 'public' | 'private' | 'mutuals_only' {
  if (value === 'public' || value === 'private' || value === 'mutuals_only') {
    return value;
  }
  return 'private';
}

function normalizeTier(value: string | null): 'free' | 'premium' | 'unknown' {
  if (value === 'free' || value === 'premium') {
    return value;
  }
  return 'free';
}

function toProfileDto(row: ProfileRow) {
  return {
    profileId: row.id,
    username: row.username ?? row.id,
    displayName: row.display_name ?? '',
    email: row.email,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    privacy: normalizePrivacy(row.privacy),
    subscriptionTier: normalizeTier(row.subscription_tier),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MeAggregate {
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

function buildMeAggregate(row: ProfileRow, authContext: AuthenticatedContext): MeAggregate {
  const profile = toProfileDto(row);

  return {
    profile,
    auth: {
      authUserId: authContext.user.authUserId,
      profileId: authContext.user.profileId,
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
  const supabase = getServiceClient(config);

  const { data: row, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authCtx.user.profileId)
    .single();

  if (error || !row) {
    throw new AppError('profile_not_found', 'Profile not found', 404);
  }

  const aggregate = buildMeAggregate(row as ProfileRow, authCtx);

  // Enrich with linked auth identities if the table exists
  const { data: identities } = await supabase
    .from('auth_identities')
    .select('provider, is_primary')
    .eq('user_id', authCtx.user.profileId);

  if (identities && identities.length > 0) {
    aggregate.auth.linkedProviders = identities.map((i: { provider: string }) => i.provider);
    const primary = identities.find((i: { is_primary: boolean }) => i.is_primary);
    if (primary) {
      aggregate.auth.primaryProvider = (primary as { provider: string }).provider;
    }
  }

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

  if (body.displayName !== undefined) {
    updateFields.display_name = body.displayName;
  }
  if (body.bio !== undefined) {
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
    updateFields.privacy = body.privacy;
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

  const aggregate = buildMeAggregate(row as ProfileRow, authCtx);
  sendJsonSuccess(response, 200, context.requestId, aggregate);
}
