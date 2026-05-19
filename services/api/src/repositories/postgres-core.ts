import { AppError } from '../errors.js';
import { AppConfig } from '../types.js';
import { queryOne, queryRows, withTransaction } from '../db.js';
import { ProfileRow } from '../routes/profile.js';
import { SituationshipRow } from '../routes/situationships.js';

export interface IdentityRow {
  provider: string;
  is_primary: boolean;
}

export interface FriendshipRow {
  id?: string;
  requester_id: string;
  addressee_id: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'declined' | 'blocked';
  requested_at?: string;
  created_at?: string;
  updated_at?: string | null;
  responded_at?: string | null;
}

export interface FriendshipAggregateRow extends FriendshipRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'declined' | 'blocked';
  requested_at: string;
  created_at: string;
  requester_username: string | null;
  requester_name: string | null;
  requester_display_name: string | null;
  requester_avatar_url: string | null;
  addressee_username: string | null;
  addressee_name: string | null;
  addressee_display_name: string | null;
  addressee_avatar_url: string | null;
}

export interface FriendSuggestionAggregateRow {
  id: string;
  suggested_profile_id: string;
  source: 'contacts' | 'mutual_friend' | 'shared_invite' | 'shared_voter' | 'provider_link';
  reason_code: string;
  score: number;
  created_at: string;
  expires_at: string;
  username: string | null;
  name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  mutual_count: number;
}

export interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
}

export interface FeedProfileRow {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export interface VotingSessionRow {
  id: string;
  owner_id: string;
  invite_code: string;
  title: string;
  description: string | null;
  is_anonymous: boolean;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface VoteRow {
  id: string;
  voting_session_id: string;
  situationship_id: string;
  voter_id: string | null;
  voter_identity: string | null;
  voter_name: string | null;
  vote_type: 'best_fit' | 'not_the_one';
  comment: string | null;
  created_at: string;
}

export interface ShareInviteRow {
  id: string;
  inviter_profile_id: string;
  invite_token: string;
  target_type: 'voting_session' | 'feed_submission' | 'friend_invite';
  target_id: string | null;
  channel: 'sms' | 'ios_share' | 'web_share' | 'copy_link' | 'unknown';
  recipient_contact_hmac: string | null;
  clicked_at: string | null;
  converted_profile_id: string | null;
  created_at: string;
  expires_at: string;
}

export interface MediaAssetRow {
  id: string;
  owner_profile_id: string;
  target_type: 'profile_avatar' | 'situationship_image' | 'feed_submission_image';
  target_id: string | null;
  storage_provider: 's3' | 'local';
  storage_bucket: string | null;
  storage_key: string;
  public_url: string;
  content_type: string;
  byte_size: number;
  created_at: string;
}

export interface FeedSubmissionRow {
  id: string;
  author_profile_id: string;
  situationship_id: string;
  body: string | null;
  image_media_id: string | null;
  image_url: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedSubmissionAggregateRow extends FeedSubmissionRow {
  author_username: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  situationship_name: string;
  situationship_emoji: string;
  situationship_category: string;
  situationship_description: string | null;
  situationship_rank: number;
  situationship_is_active: boolean;
  situationship_created_at: string;
  situationship_updated_at: string;
  situationship_primary_image_id: string | null;
  situationship_primary_image_url: string | null;
  situationship_image_count: number;
  situationship_has_images: boolean;
  best_fit_count: number;
  not_the_one_count: number;
  viewer_vote_type: 'best_fit' | 'not_the_one' | null;
  viewer_vote_count: number;
  viewer_best_fit_count: number;
  viewer_not_the_one_count: number;
  feed_comments: FeedSubmissionCommentAggregateRow[] | null;
}

export interface FeedSubmissionVoteRow {
  id: string;
  feed_submission_id: string;
  voter_profile_id: string;
  vote_type: 'best_fit' | 'not_the_one';
  comment: string | null;
  created_at: string;
}

export interface FeedSubmissionVoteMutationRow extends FeedSubmissionVoteRow {
  voter_vote_count: number;
  votes_cast: number;
}

export interface FeedSubmissionCommentRow {
  id: string;
  feed_submission_id: string;
  commenter_profile_id: string;
  parent_comment_id: string | null;
  vote_type: 'best_fit' | 'not_the_one' | null;
  voter_vote_count: number;
  comment: string;
  created_at: string;
}

export interface FeedSubmissionCommentAggregateRow {
  commentId: string;
  parentCommentId: string | null;
  voterProfile: {
    profileId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  voteType: 'best_fit' | 'not_the_one' | null;
  voterVoteCount: number;
  comment: string;
  createdAt: string;
}

function privacyBooleans(privacy: string): { isPublic: boolean; mutualsOnly: boolean } {
  return {
    isPublic: privacy === 'public',
    mutualsOnly: privacy === 'mutuals_only',
  };
}

function normalizeUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/_{2,}/gu, '_')
    .replace(/^_|_$/gu, '') || 'user';
}

export async function getProfileById(
  config: AppConfig,
  profileId: string,
): Promise<ProfileRow | null> {
  return queryOne<ProfileRow>(config, 'SELECT * FROM profiles WHERE id = $1', [profileId]);
}

export async function getProfileByUsername(
  config: AppConfig,
  username: string,
): Promise<Pick<ProfileRow, 'id'> | null> {
  return queryOne<Pick<ProfileRow, 'id'>>(
    config,
    'SELECT id FROM profiles WHERE lower(username) = lower($1)',
    [username],
  );
}

export async function listAuthIdentities(
  config: AppConfig,
  platformUserId: string | null | undefined,
): Promise<IdentityRow[]> {
  if (!platformUserId) {
    return [];
  }

  return queryRows<IdentityRow>(
    config,
    `SELECT provider, is_primary
       FROM auth_identities
      WHERE platform_user_id = $1
      ORDER BY linked_at ASC`,
    [platformUserId],
  );
}

export async function updateProfile(
  config: AppConfig,
  profileId: string,
  input: {
    username?: string;
    name?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    privacy?: 'public' | 'private' | 'mutuals_only';
  },
): Promise<ProfileRow> {
  const assignments: string[] = [];
  const params: Array<string | boolean | null> = [];

  function set(column: string, value: string | boolean | null): void {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (input.username !== undefined) set('username', normalizeUsername(input.username));
  if (input.name !== undefined) {
    set('name', input.name);
    set('display_name', input.name);
  }
  if (input.bio !== undefined) set('bio', input.bio);
  if (input.avatarUrl !== undefined) set('avatar_url', input.avatarUrl);
  if (input.privacy !== undefined) {
    const booleans = privacyBooleans(input.privacy);
    set('privacy', input.privacy);
    set('is_public', booleans.isPublic);
    set('mutuals_only', booleans.mutualsOnly);
  }

  params.push(profileId);
  const row = await queryOne<ProfileRow>(
    config,
    `UPDATE profiles
        SET ${assignments.join(', ')}, updated_at = now()
      WHERE id = $${params.length}
      RETURNING *`,
    params,
  );

  if (!row) {
    throw new AppError('update_failed', 'Failed to update profile', 500);
  }

  return row;
}

export async function createProfileAvatarMedia(
  config: AppConfig,
  input: {
    ownerProfileId: string;
    storageProvider: 's3' | 'local';
    storageBucket: string | null;
    storageKey: string;
    publicUrl: string;
    contentType: string;
    byteSize: number;
  },
): Promise<{ media: MediaAssetRow; profile: ProfileRow }> {
  return withTransaction(config, async (client) => {
    const media = await client.query<MediaAssetRow>(
      `INSERT INTO media_assets(
         owner_profile_id,
         target_type,
         target_id,
         storage_provider,
         storage_bucket,
         storage_key,
         public_url,
         content_type,
         byte_size
       )
       VALUES ($1, 'profile_avatar', $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.ownerProfileId,
        input.storageProvider,
        input.storageBucket,
        input.storageKey,
        input.publicUrl,
        input.contentType,
        input.byteSize,
      ],
    );

    const profile = await client.query<ProfileRow>(
      `UPDATE profiles
          SET avatar_url = $2,
              profile_image_id = $3,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [input.ownerProfileId, input.publicUrl, media.rows[0].id],
    );

    if (!profile.rows[0]) {
      throw new AppError('profile_not_found', 'Profile not found', 404);
    }

    return { media: media.rows[0], profile: profile.rows[0] };
  });
}

export async function createSituationshipImageMedia(
  config: AppConfig,
  input: {
    ownerProfileId: string;
    situationshipId: string;
    storageProvider: 's3' | 'local';
    storageBucket: string | null;
    storageKey: string;
    publicUrl: string;
    contentType: string;
    byteSize: number;
  },
): Promise<{ media: MediaAssetRow; situationship: SituationshipRow }> {
  return withTransaction(config, async (client) => {
    const situationship = await client.query<Pick<SituationshipRow, 'id'>>(
      `SELECT id
         FROM situationships
        WHERE id = $1
          AND user_id = $2
        LIMIT 1`,
      [input.situationshipId, input.ownerProfileId],
    );

    if (!situationship.rows[0]) {
      throw new AppError('not_found', 'Situationship not found or not owned by user', 404);
    }

    const media = await client.query<MediaAssetRow>(
      `INSERT INTO media_assets(
         owner_profile_id,
         target_type,
         target_id,
         storage_provider,
         storage_bucket,
         storage_key,
         public_url,
         content_type,
         byte_size
       )
       VALUES ($1, 'situationship_image', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.ownerProfileId,
        input.situationshipId,
        input.storageProvider,
        input.storageBucket,
        input.storageKey,
        input.publicUrl,
        input.contentType,
        input.byteSize,
      ],
    );

    const updated = await client.query<SituationshipRow>(
      `UPDATE situationships
          SET primary_image_id = $3,
              primary_image_url = $4,
              image_count = GREATEST(image_count, 0) + 1,
              has_images = true,
              updated_at = now()
        WHERE id = $1
          AND user_id = $2
        RETURNING *`,
      [input.situationshipId, input.ownerProfileId, media.rows[0].id, input.publicUrl],
    );

    return { media: media.rows[0], situationship: updated.rows[0] };
  });
}

export async function createOrUpdateDevelopmentProfile(
  config: AppConfig,
  input: {
    profileId?: string;
    username: string;
    displayName: string;
    email: string | null;
    privacy: 'public' | 'private' | 'mutuals_only';
  },
): Promise<ProfileRow> {
  const username = normalizeUsername(input.username);
  const booleans = privacyBooleans(input.privacy);

  return withTransaction(config, async (client) => {
    const existing = await client.query<Pick<ProfileRow, 'id'>>(
      input.profileId
        ? 'SELECT id FROM profiles WHERE id = $1 OR lower(username) = lower($2) LIMIT 1'
        : 'SELECT id FROM profiles WHERE lower(username) = lower($1) LIMIT 1',
      input.profileId ? [input.profileId, username] : [username],
    );

    if (existing.rows[0]) {
      const updated = await client.query<ProfileRow>(
        `UPDATE profiles
            SET username = $2,
                name = $3,
                display_name = $3,
                email = $4,
                privacy = $5,
                is_public = $6,
                mutuals_only = $7,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [
          existing.rows[0].id,
          username,
          input.displayName,
          input.email,
          input.privacy,
          booleans.isPublic,
          booleans.mutualsOnly,
        ],
      );
      return updated.rows[0];
    }

    const platformUser = await client.query<{ id: string }>(
      `INSERT INTO platform_users(primary_email, display_name)
       VALUES ($1, $2)
       RETURNING id`,
      [input.email, input.displayName],
    );

    const inserted = await client.query<ProfileRow>(
      `INSERT INTO profiles(
         ${input.profileId ? 'id, ' : ''}
         platform_user_id,
         username,
         name,
         display_name,
         email,
         privacy,
         is_public,
         mutuals_only
       )
       VALUES (${input.profileId ? '$1, ' : ''}${input.profileId ? '$2, $3, $4, $4, $5, $6, $7, $8' : '$1, $2, $3, $3, $4, $5, $6, $7'})
       RETURNING *`,
      input.profileId
        ? [
            input.profileId,
            platformUser.rows[0].id,
            username,
            input.displayName,
            input.email,
            input.privacy,
            booleans.isPublic,
            booleans.mutualsOnly,
          ]
        : [
            platformUser.rows[0].id,
            username,
            input.displayName,
            input.email,
            input.privacy,
            booleans.isPublic,
            booleans.mutualsOnly,
          ],
    );

    return inserted.rows[0];
  });
}

export async function listSituationships(
  config: AppConfig,
  profileId: string,
): Promise<SituationshipRow[]> {
  return queryRows<SituationshipRow>(
    config,
    `SELECT *
       FROM situationships
      WHERE user_id = $1
      ORDER BY rank ASC, created_at ASC`,
    [profileId],
  );
}

export async function createSituationship(
  config: AppConfig,
  profileId: string,
  input: {
    name: string;
    emoji: string;
    category: string;
    description: string | null;
  },
): Promise<SituationshipRow> {
  return withTransaction(config, async (client) => {
    const nextRank = await client.query<{ next_rank: number }>(
      'SELECT COALESCE(MAX(rank) + 1, 0) AS next_rank FROM situationships WHERE user_id = $1',
      [profileId],
    );

    const inserted = await client.query<SituationshipRow>(
      `INSERT INTO situationships(user_id, name, emoji, category, description, rank)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        profileId,
        input.name,
        input.emoji,
        input.category,
        input.description,
        nextRank.rows[0]?.next_rank ?? 0,
      ],
    );

    return inserted.rows[0];
  });
}

export async function updateSituationship(
  config: AppConfig,
  profileId: string,
  situationshipId: string,
  input: {
    name?: string;
    emoji?: string;
    category?: string;
    description?: string | null;
    isActive?: boolean;
  },
): Promise<SituationshipRow | null> {
  const assignments: string[] = [];
  const params: Array<string | boolean | null> = [];

  function set(column: string, value: string | boolean | null): void {
    params.push(value);
    assignments.push(`${column} = $${params.length}`);
  }

  if (input.name !== undefined) set('name', input.name);
  if (input.emoji !== undefined) set('emoji', input.emoji);
  if (input.category !== undefined) set('category', input.category);
  if (input.description !== undefined) set('description', input.description);
  if (input.isActive !== undefined) set('is_active', input.isActive);

  params.push(situationshipId, profileId);

  return queryOne<SituationshipRow>(
    config,
    `UPDATE situationships
        SET ${assignments.join(', ')}, updated_at = now()
      WHERE id = $${params.length - 1}
        AND user_id = $${params.length}
      RETURNING *`,
    params,
  );
}

export async function deleteSituationship(
  config: AppConfig,
  profileId: string,
  situationshipId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `DELETE FROM situationships
      WHERE id = $1
        AND user_id = $2
      RETURNING id`,
    [situationshipId, profileId],
  );
  return Boolean(row);
}

export async function reorderSituationships(
  config: AppConfig,
  profileId: string,
  orderedIds: string[],
): Promise<SituationshipRow[]> {
  return withTransaction(config, async (client) => {
    const current = await client.query<Pick<SituationshipRow, 'id'>>(
      'SELECT id FROM situationships WHERE user_id = $1 ORDER BY rank ASC, created_at ASC',
      [profileId],
    );
    validateOrderedIds(orderedIds, current.rows.map((row) => row.id));

    for (const [rank, id] of orderedIds.entries()) {
      await client.query(
        'UPDATE situationships SET rank = $1, updated_at = now() WHERE id = $2 AND user_id = $3',
        [rank, id, profileId],
      );
    }

    const updated = await client.query<SituationshipRow>(
      'SELECT * FROM situationships WHERE user_id = $1 ORDER BY rank ASC, created_at ASC',
      [profileId],
    );
    return updated.rows;
  });
}

function validateOrderedIds(orderedIds: string[], currentIds: string[]): void {
  if (orderedIds.length !== currentIds.length) {
    throw new AppError(
      'validation_error',
      'orderedSituationshipIds must include every situationship exactly once',
      400,
    );
  }

  const currentSet = new Set(currentIds);
  const orderedSet = new Set(orderedIds);

  for (const id of orderedIds) {
    if (!currentSet.has(id)) {
      throw new AppError('validation_error', `Unknown situationship ID: ${id}`, 400);
    }
  }

  if (orderedSet.size !== orderedIds.length) {
    throw new AppError('validation_error', 'Duplicate IDs in orderedSituationshipIds', 400);
  }
}

export async function listAcceptedFriendships(
  config: AppConfig,
  profileId: string,
): Promise<FriendshipRow[]> {
  return queryRows<FriendshipRow>(
    config,
    `SELECT requester_id, addressee_id, responded_at, updated_at
       FROM friendships
      WHERE status = 'accepted'
        AND (requester_id = $1 OR addressee_id = $1)
        AND NOT EXISTS (
          SELECT 1
            FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = CASE
                    WHEN friendships.requester_id = $1 THEN friendships.addressee_id
                    ELSE friendships.requester_id
                 END)
              OR (b.blocked_id = $1 AND b.blocker_id = CASE
                    WHEN friendships.requester_id = $1 THEN friendships.addressee_id
                    ELSE friendships.requester_id
                 END)
        )`,
    [profileId],
  );
}

export async function listFriendshipsForProfile(
  config: AppConfig,
  profileId: string,
): Promise<FriendshipAggregateRow[]> {
  return queryRows<FriendshipAggregateRow>(
    config,
    `SELECT f.*,
            requester.username AS requester_username,
            requester.name AS requester_name,
            requester.display_name AS requester_display_name,
            requester.avatar_url AS requester_avatar_url,
            addressee.username AS addressee_username,
            addressee.name AS addressee_name,
            addressee.display_name AS addressee_display_name,
            addressee.avatar_url AS addressee_avatar_url
       FROM friendships f
       JOIN profiles requester ON requester.id = f.requester_id
       JOIN profiles addressee ON addressee.id = f.addressee_id
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status IN ('pending', 'accepted')
        AND NOT EXISTS (
          SELECT 1
            FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = CASE
                    WHEN f.requester_id = $1 THEN f.addressee_id
                    ELSE f.requester_id
                 END)
              OR (b.blocked_id = $1 AND b.blocker_id = CASE
                    WHEN f.requester_id = $1 THEN f.addressee_id
                    ELSE f.requester_id
                 END)
        )
      ORDER BY f.updated_at DESC, f.created_at DESC`,
    [profileId],
  );
}

export async function findFriendshipBetweenProfiles(
  config: AppConfig,
  profileAId: string,
  profileBId: string,
): Promise<FriendshipRow | null> {
  return queryOne<FriendshipRow>(
    config,
    `SELECT *
       FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
      ORDER BY created_at DESC
      LIMIT 1`,
    [profileAId, profileBId],
  );
}

export async function hasBlockBetweenProfiles(
  config: AppConfig,
  profileAId: string,
  profileBId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `SELECT id
       FROM blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1`,
    [profileAId, profileBId],
  );
  return Boolean(row);
}

export async function createBlock(
  config: AppConfig,
  input: {
    blockerProfileId: string;
    blockedProfileId: string;
    reason: string | null;
  },
): Promise<BlockRow> {
  return withTransaction(config, async (client) => {
    const inserted = await client.query<BlockRow>(
      `INSERT INTO blocks(blocker_id, blocked_id, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.blockerProfileId, input.blockedProfileId, input.reason],
    );

    await client.query(
      `DELETE FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)`,
      [input.blockerProfileId, input.blockedProfileId],
    );

    return inserted.rows[0];
  });
}

export async function deleteBlock(
  config: AppConfig,
  blockerProfileId: string,
  blockedProfileId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `DELETE FROM blocks
      WHERE blocker_id = $1
        AND blocked_id = $2
      RETURNING id`,
    [blockerProfileId, blockedProfileId],
  );
  return Boolean(row);
}

export async function listBlocksForProfile(
  config: AppConfig,
  blockerProfileId: string,
): Promise<BlockRow[]> {
  return queryRows<BlockRow>(
    config,
    'SELECT * FROM blocks WHERE blocker_id = $1 ORDER BY created_at DESC',
    [blockerProfileId],
  );
}

export async function createFriendRequest(
  config: AppConfig,
  requesterProfileId: string,
  addresseeProfileId: string,
): Promise<FriendshipRow> {
  const row = await queryOne<FriendshipRow>(
    config,
    `INSERT INTO friendships(requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [requesterProfileId, addresseeProfileId],
  );

  if (!row) {
    throw new AppError('create_failed', 'Failed to create friend request', 500);
  }

  return row;
}

export async function acceptFriendRequest(
  config: AppConfig,
  friendshipId: string,
  addresseeProfileId: string,
): Promise<FriendshipRow | null> {
  return queryOne<FriendshipRow>(
    config,
    `UPDATE friendships
        SET status = 'accepted',
            responded_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
      WHERE id = $1
        AND addressee_id = $2
        AND status = 'pending'
      RETURNING *`,
    [friendshipId, addresseeProfileId],
  );
}

export async function declineFriendRequest(
  config: AppConfig,
  friendshipId: string,
  addresseeProfileId: string,
): Promise<FriendshipRow | null> {
  return queryOne<FriendshipRow>(
    config,
    `UPDATE friendships
        SET status = 'declined',
            responded_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
      WHERE id = $1
        AND addressee_id = $2
        AND status = 'pending'
      RETURNING *`,
    [friendshipId, addresseeProfileId],
  );
}

export async function removeFriendship(
  config: AppConfig,
  viewerProfileId: string,
  friendProfileId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `DELETE FROM friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)
        )
      RETURNING id`,
    [viewerProfileId, friendProfileId],
  );
  return Boolean(row);
}

export async function dismissFriendSuggestion(
  config: AppConfig,
  profileId: string,
  suggestionId: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    `UPDATE friend_suggestions
        SET status = 'dismissed'
      WHERE id = $1
        AND profile_id = $2
        AND status = 'active'
      RETURNING id`,
    [suggestionId, profileId],
  );
  return Boolean(row);
}

export async function markFriendSuggestionRequested(
  config: AppConfig,
  profileId: string,
  suggestedProfileId: string,
): Promise<void> {
  await queryOne<{ id: string }>(
    config,
    `UPDATE friend_suggestions
        SET status = 'requested'
      WHERE profile_id = $1
        AND suggested_profile_id = $2
        AND status = 'active'
      RETURNING id`,
    [profileId, suggestedProfileId],
  );
}

export async function listFriendSuggestions(
  config: AppConfig,
  profileId: string,
  limit = 5,
): Promise<FriendSuggestionAggregateRow[]> {
  return queryRows<FriendSuggestionAggregateRow>(
    config,
    `SELECT fs.id,
            fs.suggested_profile_id,
            fs.source,
            fs.reason_code,
            fs.score,
            fs.created_at,
            fs.expires_at,
            p.username,
            p.name,
            p.display_name,
            p.avatar_url,
            COALESCE(mutuals.mutual_count, 0)::integer AS mutual_count
       FROM friend_suggestions fs
       JOIN profiles p ON p.id = fs.suggested_profile_id
       LEFT JOIN LATERAL (
         WITH viewer_friends AS (
           SELECT CASE
                    WHEN f.requester_id = $1 THEN f.addressee_id
                    ELSE f.requester_id
                  END AS friend_id
             FROM friendships f
            WHERE f.status = 'accepted'
              AND (f.requester_id = $1 OR f.addressee_id = $1)
         ),
         suggested_friends AS (
           SELECT CASE
                    WHEN f.requester_id = fs.suggested_profile_id THEN f.addressee_id
                    ELSE f.requester_id
                  END AS friend_id
             FROM friendships f
            WHERE f.status = 'accepted'
              AND (
                f.requester_id = fs.suggested_profile_id
                OR f.addressee_id = fs.suggested_profile_id
              )
         )
         SELECT COUNT(*)::integer AS mutual_count
           FROM viewer_friends vf
           JOIN suggested_friends sf ON sf.friend_id = vf.friend_id
       ) mutuals ON true
      WHERE fs.profile_id = $1
        AND fs.status = 'active'
        AND fs.expires_at > timezone('utc'::text, now())
        AND fs.suggested_profile_id <> $1
        AND NOT EXISTS (
          SELECT 1
            FROM friendships f
           WHERE f.status IN ('pending', 'accepted')
             AND (
               (f.requester_id = $1 AND f.addressee_id = fs.suggested_profile_id)
               OR (f.requester_id = fs.suggested_profile_id AND f.addressee_id = $1)
             )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = fs.suggested_profile_id)
              OR (b.blocker_id = fs.suggested_profile_id AND b.blocked_id = $1)
        )
      ORDER BY fs.score DESC, fs.created_at DESC
      LIMIT $2`,
    [profileId, limit],
  );
}

export async function listFeedProfiles(
  config: AppConfig,
  profileIds: string[],
): Promise<FeedProfileRow[]> {
  if (profileIds.length === 0) {
    return [];
  }

  return queryRows<FeedProfileRow>(
    config,
    'SELECT id, username, name, avatar_url FROM profiles WHERE id = ANY($1::uuid[])',
    [profileIds],
  );
}

export async function listActiveSituationshipsForOwners(
  config: AppConfig,
  ownerIds: string[],
): Promise<SituationshipRow[]> {
  if (ownerIds.length === 0) {
    return [];
  }

  return queryRows<SituationshipRow>(
    config,
    `SELECT *
       FROM situationships
      WHERE user_id = ANY($1::uuid[])
        AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 50`,
    [ownerIds],
  );
}

export async function createFeedSubmission(
  config: AppConfig,
  input: {
    authorProfileId: string;
    situationshipId: string;
    body: string | null;
    expiresAt: string;
  },
): Promise<FeedSubmissionRow> {
  return withTransaction(config, async (client) => {
    const situationship = await client.query<Pick<SituationshipRow, 'id'>>(
      `SELECT id
         FROM situationships
        WHERE id = $1
          AND user_id = $2
          AND is_active = true
        LIMIT 1`,
      [input.situationshipId, input.authorProfileId],
    );

    if (!situationship.rows[0]) {
      throw new AppError('not_found', 'Situationship not found or not owned by user', 404);
    }

    const inserted = await client.query<FeedSubmissionRow>(
      `INSERT INTO feed_submissions(
         author_profile_id,
         situationship_id,
         body,
         expires_at,
         is_active
       )
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [
        input.authorProfileId,
        input.situationshipId,
        input.body,
        input.expiresAt,
      ],
    );

    return inserted.rows[0];
  });
}

export async function createFeedSubmissionImageMedia(
  config: AppConfig,
  input: {
    ownerProfileId: string;
    feedSubmissionId: string;
    storageProvider: 's3' | 'local';
    storageBucket: string | null;
    storageKey: string;
    publicUrl: string;
    contentType: string;
    byteSize: number;
  },
): Promise<{ media: MediaAssetRow; submission: FeedSubmissionRow }> {
  return withTransaction(config, async (client) => {
    const submission = await client.query<Pick<FeedSubmissionRow, 'id'>>(
      `SELECT id
         FROM feed_submissions
        WHERE id = $1
          AND author_profile_id = $2
        LIMIT 1`,
      [input.feedSubmissionId, input.ownerProfileId],
    );

    if (!submission.rows[0]) {
      throw new AppError('not_found', 'Feed submission not found or not owned by user', 404);
    }

    const media = await client.query<MediaAssetRow>(
      `INSERT INTO media_assets(
         owner_profile_id,
         target_type,
         target_id,
         storage_provider,
         storage_bucket,
         storage_key,
         public_url,
         content_type,
         byte_size
       )
       VALUES ($1, 'feed_submission_image', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.ownerProfileId,
        input.feedSubmissionId,
        input.storageProvider,
        input.storageBucket,
        input.storageKey,
        input.publicUrl,
        input.contentType,
        input.byteSize,
      ],
    );

    const updated = await client.query<FeedSubmissionRow>(
      `UPDATE feed_submissions
          SET image_media_id = $3,
              image_url = $4,
              updated_at = now()
        WHERE id = $1
          AND author_profile_id = $2
        RETURNING *`,
      [input.feedSubmissionId, input.ownerProfileId, media.rows[0].id, input.publicUrl],
    );

    return { media: media.rows[0], submission: updated.rows[0] };
  });
}

export async function getFeedSubmissionByIdForOwner(
  config: AppConfig,
  feedSubmissionId: string,
  ownerProfileId: string,
): Promise<Pick<FeedSubmissionRow, 'id'> | null> {
  return queryOne<Pick<FeedSubmissionRow, 'id'>>(
    config,
    `SELECT id
       FROM feed_submissions
      WHERE id = $1
        AND author_profile_id = $2
      LIMIT 1`,
    [feedSubmissionId, ownerProfileId],
  );
}

export async function listFeedSubmissions(
  config: AppConfig,
  viewerProfileId: string,
): Promise<FeedSubmissionAggregateRow[]> {
  const friendships = await listAcceptedFriendships(config, viewerProfileId);
  const eligibleAuthorIds = new Set<string>([viewerProfileId]);

  for (const row of friendships) {
    const friendId =
      row.requester_id === viewerProfileId ? row.addressee_id : row.requester_id;
    if (friendId) {
      eligibleAuthorIds.add(friendId);
    }
  }

  return queryRows<FeedSubmissionAggregateRow>(
    config,
    `SELECT fs.*,
            p.username AS author_username,
            p.name AS author_name,
            p.avatar_url AS author_avatar_url,
            s.name AS situationship_name,
            s.emoji AS situationship_emoji,
            s.category AS situationship_category,
            s.description AS situationship_description,
            s.rank AS situationship_rank,
            s.is_active AS situationship_is_active,
            s.created_at AS situationship_created_at,
            s.updated_at AS situationship_updated_at,
            s.primary_image_id AS situationship_primary_image_id,
            s.primary_image_url AS situationship_primary_image_url,
            s.image_count AS situationship_image_count,
            s.has_images AS situationship_has_images,
            COALESCE(vote_counts.best_fit_count, 0)::integer AS best_fit_count,
            COALESCE(vote_counts.not_the_one_count, 0)::integer AS not_the_one_count,
            viewer_vote.vote_type AS viewer_vote_type,
            COALESCE(viewer_vote.vote_count, 0)::integer AS viewer_vote_count,
            COALESCE(viewer_vote.best_fit_count, 0)::integer AS viewer_best_fit_count,
            COALESCE(viewer_vote.not_the_one_count, 0)::integer AS viewer_not_the_one_count,
            COALESCE(feed_comments.comments, '[]'::jsonb) AS feed_comments
       FROM feed_submissions fs
       JOIN profiles p ON p.id = fs.author_profile_id
       JOIN situationships s ON s.id = fs.situationship_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE vote_type = 'best_fit')::integer AS best_fit_count,
                COUNT(*) FILTER (WHERE vote_type = 'not_the_one')::integer AS not_the_one_count
           FROM feed_submission_votes
          WHERE feed_submission_id = fs.id
       ) vote_counts ON true
       LEFT JOIN LATERAL (
         SELECT (
                  SELECT latest_vote.vote_type
                    FROM feed_submission_votes latest_vote
                   WHERE latest_vote.feed_submission_id = fs.id
                     AND latest_vote.voter_profile_id = $1
                   ORDER BY latest_vote.created_at DESC
                   LIMIT 1
                ) AS vote_type,
                COUNT(*)::integer AS vote_count,
                COUNT(*) FILTER (WHERE viewer_votes.vote_type = 'best_fit')::integer AS best_fit_count,
                COUNT(*) FILTER (WHERE viewer_votes.vote_type = 'not_the_one')::integer AS not_the_one_count
           FROM feed_submission_votes viewer_votes
          WHERE viewer_votes.feed_submission_id = fs.id
            AND viewer_votes.voter_profile_id = $1
       ) viewer_vote ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
                  jsonb_build_object(
                    'commentId', commented.id,
                    'parentCommentId', commented.parent_comment_id,
                    'voterProfile', jsonb_build_object(
                      'profileId', commenter.id,
                      'username', COALESCE(commenter.username, ''),
                      'displayName', COALESCE(commenter.name, commenter.username, 'HINTO friend'),
                      'avatarUrl', commenter.avatar_url
                    ),
                    'voteType', commented.vote_type,
                    'voterVoteCount', commenter_vote_counts.vote_count,
                    'comment', commented.comment,
                    'createdAt', commented.created_at
                  )
                  ORDER BY commented.created_at DESC
                ) AS comments
           FROM (
             SELECT new_comment.id,
                    new_comment.parent_comment_id,
                    new_comment.commenter_profile_id,
                    new_comment.vote_type,
                    new_comment.voter_vote_count,
                    new_comment.comment,
                    new_comment.created_at
               FROM feed_submission_comments new_comment
              WHERE new_comment.feed_submission_id = fs.id
             UNION ALL
             SELECT legacy_comment.id,
                    NULL::uuid AS parent_comment_id,
                    legacy_comment.voter_profile_id AS commenter_profile_id,
                    legacy_comment.vote_type,
                    legacy_comment_votes.vote_count,
                    legacy_comment.comment,
                    legacy_comment.created_at
               FROM feed_submission_votes legacy_comment
               JOIN LATERAL (
                 SELECT COUNT(*)::integer AS vote_count
                   FROM feed_submission_votes voter_votes
                  WHERE voter_votes.feed_submission_id = fs.id
                    AND voter_votes.voter_profile_id = legacy_comment.voter_profile_id
                    AND voter_votes.vote_type = legacy_comment.vote_type
               ) legacy_comment_votes ON true
              WHERE legacy_comment.feed_submission_id = fs.id
                AND legacy_comment.comment IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1
                    FROM feed_submission_comments migrated_comment
                   WHERE migrated_comment.id = legacy_comment.id
                )
           ) commented
           JOIN profiles commenter ON commenter.id = commented.commenter_profile_id
           JOIN LATERAL (
             SELECT COUNT(*)::integer AS vote_count
               FROM feed_submission_votes commenter_vote
              WHERE commenter_vote.feed_submission_id = fs.id
                AND commenter_vote.voter_profile_id = commented.commenter_profile_id
                AND (
                  commented.vote_type IS NULL
                  OR commenter_vote.vote_type = commented.vote_type
                )
           ) commenter_vote_counts ON true
       ) feed_comments ON true
      WHERE fs.is_active = true
        AND fs.author_profile_id = ANY($2::uuid[])
      ORDER BY fs.created_at DESC
      LIMIT 100`,
    [viewerProfileId, Array.from(eligibleAuthorIds)],
  );
}

export async function voteOnFeedSubmission(
  config: AppConfig,
  input: {
    feedSubmissionId: string;
    voterProfileId: string;
    voteType: 'best_fit' | 'not_the_one';
    comment: string | null;
    count: number;
  },
): Promise<FeedSubmissionVoteMutationRow> {
  return withTransaction(config, async (client) => {
    const submission = await client.query<Pick<FeedSubmissionRow, 'id'>>(
      `SELECT id
         FROM feed_submissions
        WHERE id = $1
          AND is_active = true
          AND expires_at > now()
        LIMIT 1`,
      [input.feedSubmissionId],
    );

    if (!submission.rows[0]) {
      throw new AppError('not_found', 'Feed submission not found or voting has ended', 404);
    }

    const currentVotes = await client.query<{ vote_count: number }>(
      `SELECT COUNT(*)::integer AS vote_count
         FROM feed_submission_votes
        WHERE feed_submission_id = $1
          AND voter_profile_id = $2`,
      [input.feedSubmissionId, input.voterProfileId],
    );
    const currentVoteCount = Number(currentVotes.rows[0]?.vote_count ?? 0);
    if (currentVoteCount + input.count > 99) {
      throw new AppError(
        'validation_error',
        'feed submission votes are limited to 99 per user',
        400,
      );
    }

    const votes = await client.query<FeedSubmissionVoteRow>(
      `INSERT INTO feed_submission_votes(
         feed_submission_id,
         voter_profile_id,
         vote_type,
         comment
       )
       SELECT $1, $2, $3, NULL
         FROM generate_series(1, $4) AS vote_number
       RETURNING *`,
      [
        input.feedSubmissionId,
        input.voterProfileId,
        input.voteType,
        input.count,
      ],
    );

    const latestVote = votes.rows[votes.rows.length - 1];
    return {
      ...latestVote,
      voter_vote_count: currentVoteCount + input.count,
      votes_cast: input.count,
    };
  });
}

export async function createFeedSubmissionComment(
  config: AppConfig,
  input: {
    feedSubmissionId: string;
    commenterProfileId: string;
    comment: string;
    parentCommentId: string | null;
  },
): Promise<FeedSubmissionCommentRow> {
  return withTransaction(config, async (client) => {
    const submission = await client.query<Pick<FeedSubmissionRow, 'id'>>(
      `SELECT id
         FROM feed_submissions
        WHERE id = $1
          AND is_active = true
          AND expires_at > now()
        LIMIT 1`,
      [input.feedSubmissionId],
    );

    if (!submission.rows[0]) {
      throw new AppError('not_found', 'Feed submission not found or commenting has ended', 404);
    }

    if (input.parentCommentId) {
      const parent = await client.query<Pick<FeedSubmissionCommentRow, 'id'>>(
        `SELECT id
           FROM feed_submission_comments
          WHERE id = $1
            AND feed_submission_id = $2
          LIMIT 1`,
        [input.parentCommentId, input.feedSubmissionId],
      );

      if (!parent.rows[0]) {
        throw new AppError('not_found', 'Parent comment not found', 404);
      }
    }

    const voteSnapshot = await client.query<{
      vote_type: 'best_fit' | 'not_the_one' | null;
      vote_count: number;
    }>(
      `WITH latest_vote AS (
         SELECT vote_type
           FROM feed_submission_votes
          WHERE feed_submission_id = $1
            AND voter_profile_id = $2
          ORDER BY created_at DESC
          LIMIT 1
       )
       SELECT latest_vote.vote_type,
              CASE
                WHEN latest_vote.vote_type IS NULL THEN 0
                ELSE (
                  SELECT COUNT(*)::integer
                    FROM feed_submission_votes counted
                   WHERE counted.feed_submission_id = $1
                     AND counted.voter_profile_id = $2
                     AND counted.vote_type = latest_vote.vote_type
                )
              END AS vote_count
         FROM latest_vote
       UNION ALL
       SELECT NULL::text AS vote_type, 0::integer AS vote_count
        WHERE NOT EXISTS (SELECT 1 FROM latest_vote)
       LIMIT 1`,
      [input.feedSubmissionId, input.commenterProfileId],
    );
    const snapshot = voteSnapshot.rows[0];

    const comment = await client.query<FeedSubmissionCommentRow>(
      `INSERT INTO feed_submission_comments(
         feed_submission_id,
         commenter_profile_id,
         parent_comment_id,
         vote_type,
         voter_vote_count,
         comment
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.feedSubmissionId,
        input.commenterProfileId,
        input.parentCommentId,
        snapshot?.vote_type ?? null,
        Number(snapshot?.vote_count ?? 0),
        input.comment,
      ],
    );

    const row = comment.rows[0];
    if (!row) {
      throw new AppError('create_failed', 'Failed to create feed submission comment', 500);
    }

    return row;
  });
}

export async function listOwnerVotingSessions(
  config: AppConfig,
  ownerProfileId: string,
): Promise<VotingSessionRow[]> {
  return queryRows<VotingSessionRow>(
    config,
    'SELECT * FROM voting_sessions WHERE owner_id = $1 ORDER BY created_at DESC',
    [ownerProfileId],
  );
}

export async function createShareInvite(
  config: AppConfig,
  input: {
    inviterProfileId: string;
    targetType: ShareInviteRow['target_type'];
    targetId: string | null;
    channel: ShareInviteRow['channel'];
    recipientContactHmac?: string | null;
  },
): Promise<ShareInviteRow> {
  const row = await queryOne<ShareInviteRow>(
    config,
    `INSERT INTO share_invites(
       inviter_profile_id,
       target_type,
       target_id,
       channel,
       recipient_contact_hmac
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.inviterProfileId,
      input.targetType,
      input.targetId,
      input.channel,
      input.recipientContactHmac ?? null,
    ],
  );

  if (!row) {
    throw new AppError('create_failed', 'Failed to create share invite', 500);
  }

  return row;
}

export async function createVotingSession(
  config: AppConfig,
  input: {
    ownerProfileId: string;
    title: string;
    description: string | null;
    isAnonymous: boolean;
    expiresAt: string;
  },
): Promise<VotingSessionRow> {
  return withTransaction(config, async (client) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const inserted = await client.query<VotingSessionRow>(
        `INSERT INTO voting_sessions(
           owner_id,
           invite_code,
           title,
           description,
           is_anonymous,
           expires_at,
           is_active
         )
         VALUES ($1, generate_invite_code(), $2, $3, $4, $5, true)
         ON CONFLICT (invite_code) DO NOTHING
         RETURNING *`,
        [
          input.ownerProfileId,
          input.title,
          input.description,
          input.isAnonymous,
          input.expiresAt,
        ],
      );

      if (inserted.rows[0]) {
        return inserted.rows[0];
      }
    }

    throw new AppError('invite_code_failed', 'Failed to generate a unique invite code', 500);
  });
}

export async function getVotingSessionByInviteCode(
  config: AppConfig,
  inviteCode: string,
): Promise<VotingSessionRow | null> {
  return queryOne<VotingSessionRow>(
    config,
    'SELECT * FROM voting_sessions WHERE invite_code = $1',
    [inviteCode],
  );
}

export async function getVotingSessionByIdForOwner(
  config: AppConfig,
  votingSessionId: string,
  ownerProfileId: string,
): Promise<VotingSessionRow | null> {
  return queryOne<VotingSessionRow>(
    config,
    'SELECT * FROM voting_sessions WHERE id = $1 AND owner_id = $2',
    [votingSessionId, ownerProfileId],
  );
}

export async function expireVotingSession(
  config: AppConfig,
  votingSessionId: string,
  ownerProfileId: string,
): Promise<VotingSessionRow | null> {
  return queryOne<VotingSessionRow>(
    config,
    `UPDATE voting_sessions
        SET is_active = false
      WHERE id = $1
        AND owner_id = $2
      RETURNING *`,
    [votingSessionId, ownerProfileId],
  );
}

export async function hasVoterSubmitted(
  config: AppConfig,
  votingSessionId: string,
  voterIdentity: string,
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    config,
    'SELECT id FROM votes WHERE voting_session_id = $1 AND voter_identity = $2 LIMIT 1',
    [votingSessionId, voterIdentity],
  );
  return Boolean(row);
}

export async function submitVotingSelection(
  config: AppConfig,
  input: {
    votingSessionId: string;
    bestSituationshipId: string;
    worstSituationshipId: string;
    voterIdentity: string;
    voterName: string | null;
    comment: string | null;
  },
): Promise<VoteRow[]> {
  return withTransaction(config, async (client) => {
    const inserted = await client.query<VoteRow>(
      `INSERT INTO votes(
         voting_session_id,
         situationship_id,
         voter_identity,
         voter_name,
         vote_type,
         comment
       )
       VALUES
         ($1, $2, $4, $5, 'best_fit', $6),
         ($1, $3, $4, $5, 'not_the_one', null)
       RETURNING id, voting_session_id, situationship_id, voter_id, voter_identity, voter_name, vote_type, comment, created_at`,
      [
        input.votingSessionId,
        input.bestSituationshipId,
        input.worstSituationshipId,
        input.voterIdentity,
        input.voterName,
        input.comment,
      ],
    );

    return inserted.rows;
  });
}

export async function listVotesForSession(
  config: AppConfig,
  votingSessionId: string,
): Promise<VoteRow[]> {
  return queryRows<VoteRow>(
    config,
    `SELECT id,
            voting_session_id,
            situationship_id,
            voter_id,
            voter_identity,
            voter_name,
            vote_type,
            comment,
            created_at
       FROM votes
      WHERE voting_session_id = $1`,
    [votingSessionId],
  );
}
