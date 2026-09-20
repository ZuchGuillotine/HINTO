import { IncomingMessage, ServerResponse } from 'node:http';

import { readJsonBody } from '../body.js';
import { shouldUsePostgres } from '../db.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import {
  acceptFriendRequest,
  createFriendRequest,
  declineFriendRequest,
  dismissFriendSuggestion,
  findFriendshipBetweenProfiles,
  FriendshipAggregateRow,
  FriendSuggestionAggregateRow,
  getProfileById,
  getProfileByUsername,
  hasBlockBetweenProfiles,
  listFriendshipsForProfile,
  listFriendSuggestions,
  markFriendSuggestionRequested,
  removeFriendship,
} from '../repositories/postgres-core.js';
import { getServiceClient } from '../supabase.js';
import { AppConfig, RequestContext } from '../types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface FriendProfileSummary {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface FriendshipDto {
  friendshipId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'declined' | 'blocked';
  direction: 'incoming' | 'outgoing' | 'mutual';
  otherProfile: FriendProfileSummary;
  requestedAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface SupabaseFriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'declined' | 'blocked';
  requested_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SupabaseProfileRow {
  id: string;
  username: string | null;
  name: string | null;
  display_name?: string | null;
  avatar_url: string | null;
}

interface SupabaseSuggestionRow {
  id: string;
  suggested_profile_id: string;
  source: FriendSuggestionAggregateRow['source'];
  reason_code: string;
  score: number;
  created_at: string;
  expires_at: string;
  suggested_profile?: SupabaseProfileRow | null;
}

function assertUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AppError('validation_error', `${field} must be a valid UUID`, 400);
  }
  return value;
}

function profileSummary(input: {
  id: string;
  username?: string | null;
  name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}): FriendProfileSummary {
  return {
    profileId: input.id,
    username: input.username ?? '',
    displayName: input.name ?? input.display_name ?? input.username ?? 'HINTO friend',
    avatarUrl: input.avatar_url ?? null,
  };
}

function friendshipDirection(
  row: Pick<SupabaseFriendshipRow, 'requester_id' | 'addressee_id' | 'status'>,
  viewerProfileId: string,
): FriendshipDto['direction'] {
  if (row.status === 'accepted') return 'mutual';
  return row.requester_id === viewerProfileId ? 'outgoing' : 'incoming';
}

function postgresFriendshipDto(
  row: FriendshipAggregateRow,
  viewerProfileId: string,
): FriendshipDto {
  const otherIsRequester = row.addressee_id === viewerProfileId;
  const otherProfile = otherIsRequester
    ? profileSummary({
        id: row.requester_id,
        username: row.requester_username,
        name: row.requester_name,
        display_name: row.requester_display_name,
        avatar_url: row.requester_avatar_url,
      })
    : profileSummary({
        id: row.addressee_id,
        username: row.addressee_username,
        name: row.addressee_name,
        display_name: row.addressee_display_name,
        avatar_url: row.addressee_avatar_url,
      });

  return {
    friendshipId: row.id,
    status: row.status,
    direction: friendshipDirection(row, viewerProfileId),
    otherProfile,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function supabaseFriendshipDto(
  row: SupabaseFriendshipRow,
  viewerProfileId: string,
  profileById: Map<string, SupabaseProfileRow>,
): FriendshipDto {
  const otherProfileId = row.requester_id === viewerProfileId ? row.addressee_id : row.requester_id;
  const otherProfile = profileById.get(otherProfileId);

  return {
    friendshipId: row.id,
    status: row.status,
    direction: friendshipDirection(row, viewerProfileId),
    otherProfile: otherProfile
      ? profileSummary(otherProfile)
      : profileSummary({ id: otherProfileId }),
    requestedAt: row.requested_at,
    respondedAt: row.responded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function partitionFriendships(items: FriendshipDto[]) {
  return {
    friends: items.filter((item) => item.status === 'accepted'),
    incomingRequests: items.filter(
      (item) => item.status === 'pending' && item.direction === 'incoming',
    ),
    outgoingRequests: items.filter(
      (item) => item.status === 'pending' && item.direction === 'outgoing',
    ),
  };
}

async function listSupabaseFriendshipDtos(
  config: AppConfig,
  viewerProfileId: string,
): Promise<FriendshipDto[]> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .in('status', ['pending', 'accepted'])
    .order('updated_at', { ascending: false });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch friends', 500);
  }

  const rows = ((data ?? []) as SupabaseFriendshipRow[]).filter(
    (row) => row.requester_id === viewerProfileId || row.addressee_id === viewerProfileId,
  );
  const profileIds = Array.from(
    new Set(
      rows.map((row) =>
        row.requester_id === viewerProfileId ? row.addressee_id : row.requester_id,
      ),
    ),
  );

  let profiles: SupabaseProfileRow[] = [];
  if (profileIds.length > 0) {
    const profilesResult = await supabase
      .from('profiles')
      .select('id, username, name, display_name, avatar_url')
      .in('id', profileIds);
    if (profilesResult.error) {
      throw new AppError('fetch_failed', 'Failed to fetch friend profiles', 500);
    }
    profiles = (profilesResult.data ?? []) as SupabaseProfileRow[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return rows.map((row) => supabaseFriendshipDto(row, viewerProfileId, profileById));
}

async function resolveTargetProfileId(
  config: AppConfig,
  body: Record<string, unknown>,
): Promise<string> {
  const rawProfileId = typeof body.addresseeProfileId === 'string'
    ? body.addresseeProfileId.trim()
    : '';
  if (rawProfileId) {
    assertUuid(rawProfileId, 'addresseeProfileId');
    const profile = shouldUsePostgres(config)
      ? await getProfileById(config, rawProfileId)
      : null;
    if (shouldUsePostgres(config) && !profile) {
      throw new AppError('not_found', 'Profile not found', 404);
    }
    return rawProfileId;
  }

  const username = typeof body.username === 'string'
    ? body.username.trim().replace(/^@/u, '')
    : '';
  if (!username) {
    throw new AppError('validation_error', 'addresseeProfileId or username is required', 400);
  }

  if (shouldUsePostgres(config)) {
    const profile = await getProfileByUsername(config, username);
    if (!profile) {
      throw new AppError('not_found', 'Profile not found', 404);
    }
    return profile.id;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Profile not found', 404);
  }

  return (data as { id: string }).id;
}

export async function handleListFriends(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const items = shouldUsePostgres(config)
    ? (await listFriendshipsForProfile(config, authCtx.user.profileId)).map((row) =>
        postgresFriendshipDto(row, authCtx.user.profileId),
      )
    : await listSupabaseFriendshipDtos(config, authCtx.user.profileId);

  sendJsonSuccess(response, 200, context.requestId, {
    viewerProfileId: authCtx.user.profileId,
    ...partitionFriendships(items),
  });
}

export async function handleListFriendRequests(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const items = shouldUsePostgres(config)
    ? (await listFriendshipsForProfile(config, authCtx.user.profileId)).map((row) =>
        postgresFriendshipDto(row, authCtx.user.profileId),
      )
    : await listSupabaseFriendshipDtos(config, authCtx.user.profileId);
  const { incomingRequests, outgoingRequests } = partitionFriendships(items);

  sendJsonSuccess(response, 200, context.requestId, {
    viewerProfileId: authCtx.user.profileId,
    incomingRequests,
    outgoingRequests,
  });
}

export async function handleCreateFriendRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const addresseeProfileId = await resolveTargetProfileId(config, body);

  if (addresseeProfileId === authCtx.user.profileId) {
    throw new AppError('validation_error', 'You cannot friend yourself', 400);
  }

  if (shouldUsePostgres(config)) {
    if (await hasBlockBetweenProfiles(config, authCtx.user.profileId, addresseeProfileId)) {
      throw new AppError('blocked', 'Friend requests are not available for this profile', 403);
    }

    const existing = await findFriendshipBetweenProfiles(
      config,
      authCtx.user.profileId,
      addresseeProfileId,
    );
    if (existing?.status === 'accepted') {
      throw new AppError('already_friends', 'You are already friends', 409);
    }
    if (existing?.status === 'pending' && existing.requester_id === authCtx.user.profileId) {
      throw new AppError('request_pending', 'Friend request is already pending', 409);
    }
    if (existing?.status === 'pending' && existing.addressee_id === authCtx.user.profileId && existing.id) {
      const accepted = await acceptFriendRequest(config, existing.id, authCtx.user.profileId);
      sendJsonSuccess(response, 200, context.requestId, {
        friendship: accepted,
        acceptedIncomingRequest: true,
      });
      return;
    }

    const friendship = await createFriendRequest(
      config,
      authCtx.user.profileId,
      addresseeProfileId,
    );
    await markFriendSuggestionRequested(config, authCtx.user.profileId, addresseeProfileId);
    sendJsonSuccess(response, 201, context.requestId, { friendship });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friendships')
    .insert({
      requester_id: authCtx.user.profileId,
      addressee_id: addresseeProfileId,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    const code = typeof error.code === 'string' ? error.code : '';
    if (code === '23505') {
      throw new AppError('request_pending', 'Friend request already exists', 409);
    }
    throw new AppError('create_failed', 'Failed to create friend request', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, { friendship: data });
}

export async function handleAcceptFriendRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  friendshipId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  assertUuid(friendshipId, 'friendshipId');

  if (shouldUsePostgres(config)) {
    const friendship = await acceptFriendRequest(config, friendshipId, authCtx.user.profileId);
    if (!friendship) {
      throw new AppError('not_found', 'Friend request not found', 404);
    }
    sendJsonSuccess(response, 200, context.requestId, { friendship });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friendships')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', friendshipId)
    .eq('addressee_id', authCtx.user.profileId)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Friend request not found', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, { friendship: data });
}

export async function handleDeclineFriendRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  friendshipId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  assertUuid(friendshipId, 'friendshipId');

  if (shouldUsePostgres(config)) {
    const friendship = await declineFriendRequest(config, friendshipId, authCtx.user.profileId);
    if (!friendship) {
      throw new AppError('not_found', 'Friend request not found', 404);
    }
    sendJsonSuccess(response, 200, context.requestId, { friendship });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friendships')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', friendshipId)
    .eq('addressee_id', authCtx.user.profileId)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Friend request not found', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, { friendship: data });
}

export async function handleDeleteFriend(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  friendProfileId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  assertUuid(friendProfileId, 'friendProfileId');

  if (shouldUsePostgres(config)) {
    const removed = await removeFriendship(config, authCtx.user.profileId, friendProfileId);
    if (!removed) {
      throw new AppError('not_found', 'Friendship not found', 404);
    }
    sendJsonSuccess(response, 200, context.requestId, { friendProfileId, removed: true });
    return;
  }

  const supabase = getServiceClient(config);
  const existing = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('status', 'accepted');

  if (existing.error) {
    throw new AppError('fetch_failed', 'Failed to fetch friendship', 500);
  }

  const match = ((existing.data ?? []) as SupabaseFriendshipRow[]).find(
    (row) =>
      (row.requester_id === authCtx.user.profileId && row.addressee_id === friendProfileId) ||
      (row.requester_id === friendProfileId && row.addressee_id === authCtx.user.profileId),
  );
  if (!match) {
    throw new AppError('not_found', 'Friendship not found', 404);
  }

  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', match.id)
    .select('id');

  if (error) {
    throw new AppError('delete_failed', 'Failed to remove friend', 500);
  }

  const removed = ((data ?? []) as Array<{ id: string }>).length > 0;
  if (!removed) {
    throw new AppError('not_found', 'Friendship not found', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, { friendProfileId, removed: true });
}

function suggestionDto(row: FriendSuggestionAggregateRow) {
  return {
    suggestionId: row.id,
    source: row.source,
    reasonCode: row.reason_code,
    score: row.score,
    mutualCount: row.mutual_count,
    profile: profileSummary({
      id: row.suggested_profile_id,
      username: row.username,
      name: row.name,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    }),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function supabaseSuggestionDto(row: SupabaseSuggestionRow) {
  return {
    suggestionId: row.id,
    source: row.source,
    reasonCode: row.reason_code,
    score: row.score,
    mutualCount: 0,
    profile: row.suggested_profile
      ? profileSummary(row.suggested_profile)
      : profileSummary({ id: row.suggested_profile_id }),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function handleListFriendSuggestions(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);

  if (shouldUsePostgres(config)) {
    const suggestions = await listFriendSuggestions(config, authCtx.user.profileId, 5);
    sendJsonSuccess(response, 200, context.requestId, {
      viewerProfileId: authCtx.user.profileId,
      suggestions: suggestions.map(suggestionDto),
    });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friend_suggestions')
    .select('*, suggested_profile:profiles(id, username, name, display_name, avatar_url)')
    .eq('profile_id', authCtx.user.profileId)
    .eq('status', 'active')
    .order('score', { ascending: false })
    .limit(5);

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch friend suggestions', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    viewerProfileId: authCtx.user.profileId,
    suggestions: ((data ?? []) as SupabaseSuggestionRow[]).map(supabaseSuggestionDto),
  });
}

export async function handleDismissFriendSuggestion(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  suggestionId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  assertUuid(suggestionId, 'suggestionId');

  if (shouldUsePostgres(config)) {
    const dismissed = await dismissFriendSuggestion(config, authCtx.user.profileId, suggestionId);
    if (!dismissed) {
      throw new AppError('not_found', 'Friend suggestion not found', 404);
    }
    sendJsonSuccess(response, 200, context.requestId, { suggestionId, dismissed: true });
    return;
  }

  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('friend_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', suggestionId)
    .eq('profile_id', authCtx.user.profileId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    throw new AppError('update_failed', 'Failed to dismiss friend suggestion', 500);
  }
  if (!data || data.length === 0) {
    throw new AppError('not_found', 'Friend suggestion not found', 404);
  }

  sendJsonSuccess(response, 200, context.requestId, { suggestionId, dismissed: true });
}
