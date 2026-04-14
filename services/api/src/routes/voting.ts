import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from '../types.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import { getServiceClient } from '../supabase.js';
import { readJsonBody } from '../body.js';
import {
  assertVotingSessionCanAcceptVotes,
  buildVotingResultsAggregate,
  generateInviteCode,
  normalizeInviteCode,
  normalizeOptionalComment,
  normalizeOptionalVoterName,
  normalizeVoterIdentity,
  resolveVotingSessionStatus,
  validateVoteSubmission,
} from './voting-shared.js';

interface VotingSessionRow {
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

interface SituationshipRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  category: string | null;
  description: string | null;
  rank: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  name: string | null;
}

interface VoteRow {
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

function toSituationshipDto(row: SituationshipRow) {
  return {
    situationshipId: row.id,
    ownerProfileId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    category: row.category,
    description: row.description,
    rank: row.rank ?? 0,
    status: row.is_active ? ('active' as const) : ('archived' as const),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVotingSessionDto(row: VotingSessionRow) {
  return {
    votingSessionId: row.id,
    ownerProfileId: row.owner_id,
    inviteCode: row.invite_code,
    title: row.title,
    description: row.description,
    visibility: 'session_link' as const,
    anonymityMode: row.is_anonymous ? ('anonymous' as const) : ('identified' as const),
    status: resolveVotingSessionStatus({
      isActive: row.is_active,
      expiresAt: row.expires_at,
    }),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

async function generateUniqueInviteCode(config: AppConfig): Promise<string> {
  const supabase = getServiceClient(config);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateInviteCode();
    const { data, error } = await supabase
      .from('voting_sessions')
      .select('id')
      .eq('invite_code', candidate)
      .limit(1);

    if (error) {
      throw new AppError('fetch_failed', 'Failed to generate invite code', 500);
    }

    if (!data || data.length === 0) {
      return candidate;
    }
  }

  throw new AppError('invite_code_failed', 'Failed to generate a unique invite code', 500);
}

async function getOwnerActiveSituationships(
  config: AppConfig,
  ownerProfileId: string,
): Promise<SituationshipRow[]> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('situationships')
    .select('*')
    .eq('user_id', ownerProfileId)
    .eq('is_active', true)
    .order('rank', { ascending: true });

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch voting situationships', 500);
  }

  return (data ?? []) as SituationshipRow[];
}

async function getVotingSessionByInviteCode(
  config: AppConfig,
  inviteCode: string,
): Promise<VotingSessionRow> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('voting_sessions')
    .select('*')
    .eq('invite_code', normalizeInviteCode(inviteCode))
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Voting session not found', 404);
  }

  return data as VotingSessionRow;
}

async function getVotingSessionByIdForOwner(
  config: AppConfig,
  votingSessionId: string,
  ownerProfileId: string,
): Promise<VotingSessionRow> {
  const supabase = getServiceClient(config);
  const { data, error } = await supabase
    .from('voting_sessions')
    .select('*')
    .eq('id', votingSessionId)
    .eq('owner_id', ownerProfileId)
    .single();

  if (error || !data) {
    throw new AppError('not_found', 'Voting session not found', 404);
  }

  return data as VotingSessionRow;
}

/**
 * POST /v1/me/voting-sessions - Create an owner voting session for active situationships.
 */
export async function handleCreateVotingSession(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const body = await readJsonBody(request);
  const supabase = getServiceClient(config);

  const activeSituationships = await getOwnerActiveSituationships(config, authCtx.user.profileId);
  if (activeSituationships.length < 2) {
    throw new AppError(
      'validation_error',
      'At least two active situationships are required to create a voting session',
      400,
    );
  }

  const title =
    typeof body.title === 'string' && body.title.trim().length > 0
      ? body.title.trim()
      : 'Rate my situationships';
  const description =
    typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null;
  const anonymityMode = body.anonymityMode === 'identified' ? 'identified' : 'anonymous';
  const expiresInHours =
    typeof body.expiresInHours === 'number' &&
    Number.isFinite(body.expiresInHours) &&
    body.expiresInHours >= 1 &&
    body.expiresInHours <= 168
      ? Math.floor(body.expiresInHours)
      : 48;

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  const inviteCode = await generateUniqueInviteCode(config);

  const { data, error } = await supabase
    .from('voting_sessions')
    .insert({
      owner_id: authCtx.user.profileId,
      invite_code: inviteCode,
      title,
      description,
      is_anonymous: anonymityMode === 'anonymous',
      expires_at: expiresAt,
      is_active: true,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('create_failed', 'Failed to create voting session', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    session: toVotingSessionDto(data as VotingSessionRow),
    itemsCount: activeSituationships.length,
    publicPath: `/v1/voting-sessions/${inviteCode}`,
  });
}

/**
 * POST /v1/me/voting-sessions/:id/expire - Close an owner voting session.
 */
export async function handleExpireVotingSession(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  votingSessionId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const supabase = getServiceClient(config);

  await getVotingSessionByIdForOwner(config, votingSessionId, authCtx.user.profileId);

  const { data, error } = await supabase
    .from('voting_sessions')
    .update({ is_active: false })
    .eq('id', votingSessionId)
    .eq('owner_id', authCtx.user.profileId)
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('update_failed', 'Failed to expire voting session', 500);
  }

  sendJsonSuccess(response, 200, context.requestId, {
    session: toVotingSessionDto(data as VotingSessionRow),
  });
}

/**
 * GET /v1/voting-sessions/:inviteCode - Load a public voting session view.
 */
export async function handleGetPublicVotingSession(
  _request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  inviteCode: string,
): Promise<void> {
  const session = await getVotingSessionByInviteCode(config, inviteCode);
  const supabase = getServiceClient(config);

  const [ownerResult, situationshipRows] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, name')
      .eq('id', session.owner_id)
      .single(),
    getOwnerActiveSituationships(config, session.owner_id),
  ]);

  if (ownerResult.error || !ownerResult.data) {
    throw new AppError('fetch_failed', 'Failed to fetch voting session owner', 500);
  }

  const owner = ownerResult.data as ProfileRow;
  const sessionDto = toVotingSessionDto(session);

  sendJsonSuccess(response, 200, context.requestId, {
    session: sessionDto,
    ownerProfile: {
      profileId: owner.id,
      username: owner.username ?? '',
      displayName: owner.name ?? '',
    },
    viewerContext: {
      mode: 'public_session_viewer' as const,
    },
    items: situationshipRows.map(toSituationshipDto),
    capabilities: {
      canVote: sessionDto.status === 'active',
      canComment: sessionDto.status === 'active',
    },
    audience: {
      mode: 'session_link' as const,
    },
  });
}

/**
 * POST /v1/voting-sessions/:inviteCode/votes - Submit a public vote.
 */
export async function handleSubmitVote(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  inviteCode: string,
): Promise<void> {
  const session = await getVotingSessionByInviteCode(config, inviteCode);
  const status = resolveVotingSessionStatus({
    isActive: session.is_active,
    expiresAt: session.expires_at,
  });
  assertVotingSessionCanAcceptVotes(status);

  const body = await readJsonBody(request);
  const voterIdentity = normalizeVoterIdentity(body.voterIdentity);
  const voterName = normalizeOptionalVoterName(body.voterName);
  const comment = normalizeOptionalComment(body.comment);
  const activeSituationships = await getOwnerActiveSituationships(config, session.owner_id);
  const allowedIds = activeSituationships.map((item) => item.id);
  const selection = validateVoteSubmission(
    allowedIds,
    body.bestSituationshipId,
    body.worstSituationshipId,
  );

  const supabase = getServiceClient(config);
  const { data: existingVotes, error: existingVotesError } = await supabase
    .from('votes')
    .select('id')
    .eq('voting_session_id', session.id)
    .eq('voter_identity', voterIdentity)
    .limit(1);

  if (existingVotesError) {
    throw new AppError('fetch_failed', 'Failed to validate existing vote submission', 500);
  }

  if (existingVotes && existingVotes.length > 0) {
    throw new AppError(
      'duplicate_vote',
      'This voter identity has already submitted a vote for the session',
      409,
    );
  }

  const insertRows = [
    {
      voting_session_id: session.id,
      situationship_id: selection.bestSituationshipId,
      voter_id: null,
      voter_identity: voterIdentity,
      voter_name: voterName,
      vote_type: 'best_fit' as const,
      comment,
    },
    {
      voting_session_id: session.id,
      situationship_id: selection.worstSituationshipId,
      voter_id: null,
      voter_identity: voterIdentity,
      voter_name: voterName,
      vote_type: 'not_the_one' as const,
      comment: null,
    },
  ];

  const { data, error } = await supabase
    .from('votes')
    .insert(insertRows)
    .select('id, situationship_id, vote_type, created_at');

  if (error) {
    const code = typeof error.code === 'string' ? error.code : '';
    if (code === '23505') {
      throw new AppError(
        'duplicate_vote',
        'This voter identity has already submitted a vote for the session',
        409,
      );
    }

    throw new AppError('create_failed', 'Failed to submit vote', 500);
  }

  sendJsonSuccess(response, 201, context.requestId, {
    votingSessionId: session.id,
    accepted: true,
    votesRecorded: (data ?? []).length,
    selections: {
      bestSituationshipId: selection.bestSituationshipId,
      worstSituationshipId: selection.worstSituationshipId,
    },
  });
}

/**
 * GET /v1/me/voting-sessions/:id/results - Load owner-facing voting results.
 */
export async function handleGetVotingResults(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
  votingSessionId: string,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  const session = await getVotingSessionByIdForOwner(config, votingSessionId, authCtx.user.profileId);
  const supabase = getServiceClient(config);
  const situationships = await getOwnerActiveSituationships(config, session.owner_id);

  const { data: votes, error } = await supabase
    .from('votes')
    .select('id, voting_session_id, situationship_id, voter_id, voter_identity, voter_name, vote_type, comment, created_at')
    .eq('voting_session_id', session.id);

  if (error) {
    throw new AppError('fetch_failed', 'Failed to fetch voting results', 500);
  }

  const aggregate = buildVotingResultsAggregate(
    situationships.map((item) => ({
      situationshipId: item.id,
      name: item.name,
      emoji: item.emoji,
      rank: item.rank,
    })),
    (votes ?? []).map((vote) => {
      const row = vote as VoteRow;
      return {
        situationshipId: row.situationship_id,
        voteType: row.vote_type,
        voterIdentity: row.voter_identity,
        voterId: row.voter_id,
        voterName: row.voter_name,
        comment: row.comment,
        createdAt: row.created_at,
      };
    }),
    { isAnonymous: session.is_anonymous },
  );

  sendJsonSuccess(response, 200, context.requestId, {
    session: toVotingSessionDto(session),
    totalVotes: aggregate.totalVotes,
    totalVoters: aggregate.totalVoters,
    results: aggregate.results,
    comments: aggregate.comments,
  });
}
