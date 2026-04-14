import { randomBytes } from 'node:crypto';

import { AppError } from '../errors.js';

export type VotingSessionStatus = 'active' | 'expired' | 'closed';

export interface VotingSessionStatusInput {
  isActive: boolean;
  expiresAt: string;
  now?: Date;
}

export interface ResultSituationship {
  situationshipId: string;
  name: string;
  emoji: string | null;
  rank: number;
}

export interface RecordedVote {
  situationshipId: string;
  voteType: 'best_fit' | 'not_the_one';
  voterIdentity: string | null;
  voterId: string | null;
  voterName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface VotingCommentSummary {
  comment: string;
  createdAt: string;
  voteType: 'best_fit' | 'not_the_one';
  situationshipId: string;
  voterLabel: string | null;
}

export interface RankedVoteResult {
  situationshipId: string;
  name: string;
  emoji: string | null;
  bestVotes: number;
  worstVotes: number;
  totalVotes: number;
  score: number;
  rank: number;
}

export interface VotingResultsAggregate {
  totalVotes: number;
  totalVoters: number;
  results: RankedVoteResult[];
  comments: VotingCommentSummary[];
}

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function resolveVotingSessionStatus(
  input: VotingSessionStatusInput,
): VotingSessionStatus {
  const now = input.now ?? new Date();
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }

  return input.isActive ? 'active' : 'closed';
}

export function assertVotingSessionCanAcceptVotes(
  status: VotingSessionStatus,
): void {
  if (status === 'expired') {
    throw new AppError('session_expired', 'Voting session has expired', 410);
  }

  if (status === 'closed') {
    throw new AppError('session_closed', 'Voting session is closed', 410);
  }
}

export function normalizeVoterIdentity(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError('validation_error', 'voterIdentity is required', 400);
  }

  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw new AppError(
      'validation_error',
      'voterIdentity must be between 8 and 128 characters',
      400,
    );
  }

  return normalized;
}

export function normalizeOptionalVoterName(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('validation_error', 'voterName must be a string', 400);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > 80) {
    throw new AppError('validation_error', 'voterName must be 80 characters or fewer', 400);
  }

  return normalized;
}

export function normalizeOptionalComment(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError('validation_error', 'comment must be a string', 400);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > 140) {
    throw new AppError('validation_error', 'comment must be 140 characters or fewer', 400);
  }

  return normalized;
}

export function validateVoteSubmission(
  allowedSituationshipIds: string[],
  bestSituationshipId: unknown,
  worstSituationshipId: unknown,
): { bestSituationshipId: string; worstSituationshipId: string } {
  if (typeof bestSituationshipId !== 'string' || typeof worstSituationshipId !== 'string') {
    throw new AppError(
      'validation_error',
      'bestSituationshipId and worstSituationshipId are required',
      400,
    );
  }

  if (bestSituationshipId === worstSituationshipId) {
    throw new AppError(
      'validation_error',
      'bestSituationshipId and worstSituationshipId must be different',
      400,
    );
  }

  const allowed = new Set(allowedSituationshipIds);
  if (!allowed.has(bestSituationshipId) || !allowed.has(worstSituationshipId)) {
    throw new AppError(
      'validation_error',
      'Vote selections must belong to the active situationships in this session',
      400,
    );
  }

  return { bestSituationshipId, worstSituationshipId };
}

export function buildVotingResultsAggregate(
  situationships: ResultSituationship[],
  votes: RecordedVote[],
  options: { isAnonymous: boolean },
): VotingResultsAggregate {
  const countsBySituationship = new Map<string, RankedVoteResult>();
  for (const situationship of situationships) {
    countsBySituationship.set(situationship.situationshipId, {
      situationshipId: situationship.situationshipId,
      name: situationship.name,
      emoji: situationship.emoji,
      bestVotes: 0,
      worstVotes: 0,
      totalVotes: 0,
      score: 0,
      rank: 0,
    });
  }

  const uniqueVoters = new Set<string>();
  const comments: VotingCommentSummary[] = [];

  for (const vote of votes) {
    const result = countsBySituationship.get(vote.situationshipId);
    if (!result) {
      continue;
    }

    if (vote.voteType === 'best_fit') {
      result.bestVotes += 1;
    } else {
      result.worstVotes += 1;
    }

    result.totalVotes += 1;
    result.score = result.bestVotes - result.worstVotes;

    const voterKey = vote.voterIdentity ?? vote.voterId ?? vote.voterName;
    if (voterKey) {
      uniqueVoters.add(voterKey);
    }

    if (vote.comment) {
      comments.push({
        comment: vote.comment,
        createdAt: vote.createdAt,
        voteType: vote.voteType,
        situationshipId: vote.situationshipId,
        voterLabel: options.isAnonymous ? null : vote.voterName,
      });
    }
  }

  const results = Array.from(countsBySituationship.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.totalVotes !== left.totalVotes) {
        return right.totalVotes - left.totalVotes;
      }

      const leftRank = situationships.find((item) => item.situationshipId === left.situationshipId)?.rank ?? 0;
      const rightRank = situationships.find((item) => item.situationshipId === right.situationshipId)?.rank ?? 0;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.name.localeCompare(right.name);
    })
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));

  comments.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    totalVotes: votes.length,
    totalVoters: uniqueVoters.size,
    results,
    comments,
  };
}

export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let output = '';

  for (const value of bytes) {
    output += alphabet[value % alphabet.length];
  }

  return output;
}
