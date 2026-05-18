import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { shouldUsePostgres } from '../db.js';
import { readJsonBody } from '../body.js';
import {
  createFeedSubmission,
  createFeedSubmissionImageMedia,
  listFeedSubmissions,
  voteOnFeedSubmission,
} from '../repositories/postgres-core.js';
import { getServiceClient } from '../supabase.js';
import { SituationshipRow, toSituationshipDto } from './situationships.js';
import { mediaKey, parseUploadBody, storeMedia, toMediaDto } from './media.js';

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

type FeedVoteType = 'best_fit' | 'not_the_one';

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

function parseCreateFeedSubmissionBody(body: Record<string, unknown>): {
  situationshipId: string;
  submissionBody: string | null;
  expiresAt: string;
} {
  const situationshipId =
    typeof body.situationshipId === 'string' ? body.situationshipId.trim() : '';
  if (!situationshipId) {
    throw new AppError('validation_error', 'situationshipId is required', 400);
  }

  const rawBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (rawBody.length > 500) {
    throw new AppError('validation_error', 'body must be 500 characters or fewer', 400);
  }

  const expiresInHours =
    typeof body.expiresInHours === 'number' ? body.expiresInHours : Number(body.expiresInHours);
  if (!Number.isFinite(expiresInHours) || expiresInHours < 1 || expiresInHours > 168) {
    throw new AppError(
      'validation_error',
      'expiresInHours must be between 1 and 168',
      400,
    );
  }

  return {
    situationshipId,
    submissionBody: rawBody.length > 0 ? rawBody : null,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString(),
  };
}

function parseVoteBody(body: Record<string, unknown>): {
  voteType: FeedVoteType;
  comment: string | null;
} {
  const voteType = typeof body.voteType === 'string' ? body.voteType : '';
  if (voteType !== 'best_fit' && voteType !== 'not_the_one') {
    throw new AppError(
      'validation_error',
      'voteType must be best_fit or not_the_one',
      400,
    );
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (comment.length > 140) {
    throw new AppError('validation_error', 'comment must be 140 characters or fewer', 400);
  }

  return {
    voteType,
    comment: comment.length > 0 ? comment : null,
  };
}

function toFeedSubmissionDto(
  row: Awaited<ReturnType<typeof listFeedSubmissions>>[number],
  viewerProfileId: string,
) {
  const expiresAtMs = new Date(row.expires_at).getTime();
  const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();

  return {
    feedItemId: row.id,
    submissionId: row.id,
    ownerProfile: {
      profileId: row.author_profile_id,
      username: row.author_username ?? '',
      displayName: row.author_name ?? row.author_username ?? 'HINTO friend',
      avatarUrl: row.author_avatar_url ?? null,
    },
    viewerContext: {
      mode: row.author_profile_id === viewerProfileId ? ('owner' as const) : ('authorized_viewer' as const),
      viewerProfileId,
    },
    situationship: toSituationshipDto({
      id: row.situationship_id,
      user_id: row.author_profile_id,
      name: row.situationship_name,
      emoji: row.situationship_emoji,
      category: row.situationship_category,
      description: row.situationship_description,
      rank: row.situationship_rank,
      is_active: row.situationship_is_active,
      primary_image_id: row.situationship_primary_image_id,
      primary_image_url: row.situationship_primary_image_url,
      image_count: row.situationship_image_count,
      has_images: row.situationship_has_images,
      created_at: row.situationship_created_at,
      updated_at: row.situationship_updated_at,
    }),
    submission: {
      body: row.body,
      imageUrl: row.image_url,
      expiresAt: row.expires_at,
      status: row.is_active && !isExpired ? ('active' as const) : ('concluded' as const),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    voteSummary: {
      bestFitCount: row.best_fit_count,
      notTheOneCount: row.not_the_one_count,
      totalCount: row.best_fit_count + row.not_the_one_count,
    },
    viewerVote: row.viewer_vote_type,
  };
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

  if (shouldUsePostgres(config)) {
    const rows = await listFeedSubmissions(config, viewerProfileId);
    const items = rows.map((row) => toFeedSubmissionDto(row, viewerProfileId));

    sendJsonSuccess(response, 200, context.requestId, {
      viewerProfileId,
      items,
    });
    return;
  }

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

export async function handleCreateFeedSubmission(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!shouldUsePostgres(config)) {
    throw new AppError('not_configured', 'Feed submissions require DATABASE_URL', 501);
  }

  const body = await readJsonBody(request);
  const input = parseCreateFeedSubmissionBody(body);
  const submission = await createFeedSubmission(config, {
    authorProfileId: authCtx.user.profileId,
    situationshipId: input.situationshipId,
    body: input.submissionBody,
    expiresAt: input.expiresAt,
  });

  sendJsonSuccess(response, 201, context.requestId, {
    submission: {
      submissionId: submission.id,
      situationshipId: submission.situationship_id,
      body: submission.body,
      imageUrl: submission.image_url,
      expiresAt: submission.expires_at,
      status: 'active',
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
    },
  });
}

export async function handleUploadFeedSubmissionImage(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  feedSubmissionId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!shouldUsePostgres(config)) {
    throw new AppError('not_configured', 'Feed submission images require DATABASE_URL', 501);
  }

  const body = await readJsonBody(request);
  const { contentType, buffer } = parseUploadBody(body);
  const key = mediaKey(
    'feed_submission_image',
    authCtx.user.profileId,
    feedSubmissionId,
    contentType,
  );
  const stored = await storeMedia(request, config, key, contentType, buffer);
  const { media, submission } = await createFeedSubmissionImageMedia(config, {
    ownerProfileId: authCtx.user.profileId,
    feedSubmissionId,
    storageProvider: stored.storageProvider,
    storageBucket: stored.storageBucket,
    storageKey: stored.storageKey,
    publicUrl: stored.publicUrl,
    contentType,
    byteSize: buffer.length,
  });

  sendJsonSuccess(response, 201, context.requestId, {
    media: toMediaDto(media),
    submission: {
      submissionId: submission.id,
      situationshipId: submission.situationship_id,
      body: submission.body,
      imageUrl: submission.image_url,
      expiresAt: submission.expires_at,
      status: new Date(submission.expires_at).getTime() > Date.now() ? 'active' : 'concluded',
      createdAt: submission.created_at,
      updatedAt: submission.updated_at,
    },
  });
}

export async function handleVoteOnFeedSubmission(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  feedSubmissionId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!shouldUsePostgres(config)) {
    throw new AppError('not_configured', 'Feed submission voting requires DATABASE_URL', 501);
  }

  const body = await readJsonBody(request);
  const input = parseVoteBody(body);
  const vote = await voteOnFeedSubmission(config, {
    feedSubmissionId,
    voterProfileId: authCtx.user.profileId,
    voteType: input.voteType,
    comment: input.comment,
  });

  sendJsonSuccess(response, 200, context.requestId, {
    vote: {
      voteId: vote.id,
      submissionId: vote.feed_submission_id,
      voterProfileId: vote.voter_profile_id,
      voteType: vote.vote_type,
      comment: vote.comment,
      createdAt: vote.created_at,
    },
  });
}
