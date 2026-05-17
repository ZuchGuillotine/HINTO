import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { SituationshipRow, toSituationshipDto } from './situationships.js';

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  updated_at?: string | null;
  responded_at?: string | null;
}

interface FeedProfileRow {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

function collectFriendIds(
  viewerProfileId: string,
  outgoing: FriendshipRow[],
  incoming: FriendshipRow[],
): string[] {
  const ids = new Set<string>();

  for (const row of [...outgoing, ...incoming]) {
    const friendId =
      row.requester_id === viewerProfileId ? row.addressee_id : row.requester_id;
    if (friendId && friendId !== viewerProfileId) {
      ids.add(friendId);
    }
  }

  return Array.from(ids);
}

/**
 * GET /v1/me/feed - Lists active situationships from accepted friends.
 *
 * This is the first restart-era replacement for legacy sharedWith reads. Until
 * explicit per-situationship audience tables exist, accepted friendships are the
 * only audience source used for this feed.
 */
export async function handleGetFriendsFeed(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const viewerProfileId = authCtx.user.profileId;
  const supabase = getServiceClient(config);

  const [outgoingResult, incomingResult] = await Promise.all([
    supabase
      .from('friendships')
      .select('requester_id, addressee_id, responded_at, updated_at')
      .eq('requester_id', viewerProfileId)
      .eq('status', 'accepted'),
    supabase
      .from('friendships')
      .select('requester_id, addressee_id, responded_at, updated_at')
      .eq('addressee_id', viewerProfileId)
      .eq('status', 'accepted'),
  ]);

  if (outgoingResult.error || incomingResult.error) {
    throw new AppError('feed_fetch_failed', 'Failed to fetch friend graph', 500);
  }

  const friendIds = collectFriendIds(
    viewerProfileId,
    (outgoingResult.data as FriendshipRow[] | null) ?? [],
    (incomingResult.data as FriendshipRow[] | null) ?? [],
  );

  if (friendIds.length === 0) {
    sendJsonSuccess(response, 200, context.requestId, {
      viewerProfileId,
      items: [],
    });
    return;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, name, avatar_url')
    .in('id', friendIds);

  if (profilesError) {
    throw new AppError('feed_fetch_failed', 'Failed to fetch friend profiles', 500);
  }

  const ownerById = new Map(
    ((profiles as FeedProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      {
        profileId: profile.id,
        username: profile.username ?? '',
        displayName: profile.name ?? profile.username ?? 'HINTO friend',
        avatarUrl: profile.avatar_url ?? null,
      },
    ]),
  );

  const eligibleFriendIds = friendIds.filter((id) => ownerById.has(id));
  if (eligibleFriendIds.length === 0) {
    sendJsonSuccess(response, 200, context.requestId, {
      viewerProfileId,
      items: [],
    });
    return;
  }

  const { data: situationships, error: situationshipsError } = await supabase
    .from('situationships')
    .select('*')
    .in('user_id', eligibleFriendIds)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (situationshipsError) {
    throw new AppError('feed_fetch_failed', 'Failed to fetch friend situationships', 500);
  }

  const items = ((situationships as SituationshipRow[] | null) ?? [])
    .map((row) => {
      const ownerProfile = ownerById.get(row.user_id);
      if (!ownerProfile) return null;

      return {
        feedItemId: `${row.user_id}:${row.id}`,
        ownerProfile,
        viewerContext: {
          mode: 'authorized_viewer' as const,
          viewerProfileId,
        },
        situationship: toSituationshipDto(row),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  sendJsonSuccess(response, 200, context.requestId, {
    viewerProfileId,
    items,
  });
}
