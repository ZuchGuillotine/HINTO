import { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { readJsonBody } from '../body.js';
import { getServiceClient } from '../supabase.js';
import { fetchMeAggregateForProfileId } from './profile.js';

/**
 * Dev sessions use a stable UUID lookup by username.
 * If a profileId is provided and looks like a UUID, use it directly.
 * Otherwise generate a new UUID for new profiles.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizeUsername(value: unknown, fallbackProfileId: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallbackProfileId;
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/_{2,}/gu, '_')
    .replace(/^_|_$/gu, '') || fallbackProfileId;
}

function normalizeDisplayName(value: unknown, fallbackUsername: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallbackUsername
      .split(/[-_]/u)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return value.trim();
}

export async function handleCreateDevelopmentSession(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  if (config.nodeEnv === 'production') {
    throw new AppError('not_found', 'Route not found', 404);
  }

  const body = await readJsonBody(request);
  const rawUsername = normalizeUsername(body.username, typeof body.profileId === 'string' ? body.profileId : 'dev-user');
  const displayName = normalizeDisplayName(body.displayName, rawUsername);
  const email =
    typeof body.email === 'string' && body.email.trim().length > 0 ? body.email.trim() : null;
  const privacy =
    body.privacy === 'public' || body.privacy === 'mutuals_only' ? body.privacy : 'private';
  const now = new Date().toISOString();
  const supabase = getServiceClient(config);

  // If a UUID profileId was provided, look up by ID; otherwise look up by username
  let existingProfile: { id: string } | null = null;
  let profileId: string;

  if (typeof body.profileId === 'string' && isUUID(body.profileId)) {
    const { data, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', body.profileId)
      .maybeSingle();
    if (lookupError) {
      throw new AppError('profile_lookup_failed', 'Failed to load development profile', 500);
    }
    existingProfile = data;
    profileId = body.profileId;
  } else {
    const { data, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', rawUsername)
      .maybeSingle();
    if (lookupError) {
      throw new AppError('profile_lookup_failed', 'Failed to load development profile', 500);
    }
    existingProfile = data;
    profileId = existingProfile?.id ?? randomUUID();
  }
  const username = rawUsername;

  if (existingProfile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        name: displayName,
        email,
        is_public: privacy === 'public',
        mutuals_only: privacy === 'mutuals_only',
        updated_at: now,
      })
      .eq('id', profileId);

    if (updateError) {
      throw new AppError('profile_update_failed', 'Failed to refresh development profile', 500);
    }
  } else {
    // profiles.id references auth.users(id) and a trigger auto-creates the profile row,
    // so create the auth user first, then update the auto-created profile.
    const devEmail = email ?? `${username}@dev.hinto.local`;
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: devEmail,
      email_confirm: true,
      user_metadata: { dev: true, username },
    });

    if (authError || !authUser.user) {
      throw new AppError('profile_create_failed', `Failed to create auth user: ${authError?.message}`, 500);
    }

    profileId = authUser.user.id;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        username,
        name: displayName,
        email: devEmail,
        is_public: privacy === 'public',
        mutuals_only: privacy === 'mutuals_only',
        updated_at: now,
      })
      .eq('id', profileId);

    if (updateError) {
      throw new AppError('profile_create_failed', 'Failed to update development profile', 500);
    }
  }

  const accessToken = `dev-session:${profileId}`;
  const me = await fetchMeAggregateForProfileId(profileId, profileId, config);

  sendJsonSuccess(response, 200, context.requestId, {
    accessToken,
    me,
    development: true,
  });
}
