import { SituationshipDto } from './situationships.js';

export type VotingSessionStatus = 'active' | 'expired' | 'closed';
export type VotingVisibility = 'session_link';
export type VotingAnonymityMode = 'anonymous' | 'identified';
export type VoteKind = 'best_fit' | 'not_the_one';

export interface VotingSessionDto {
  votingSessionId: string;
  ownerProfileId: string;
  inviteCode: string;
  title: string;
  description: string | null;
  visibility: VotingVisibility;
  anonymityMode: VotingAnonymityMode;
  status: VotingSessionStatus;
  expiresAt: string;
  createdAt: string;
}

export interface CreateVotingSessionRequestDto {
  title?: string;
  description?: string | null;
  anonymityMode?: VotingAnonymityMode;
  expiresInHours?: number;
}

export interface CreateVotingSessionResponseDto {
  data: {
    session: VotingSessionDto;
    itemsCount: number;
    publicPath: string;
  };
}

export interface ExpireVotingSessionResponseDto {
  data: {
    session: VotingSessionDto;
  };
}

export interface PublicVotingSessionAggregateDto {
  session: VotingSessionDto;
  ownerProfile: {
    profileId: string;
    username: string;
    displayName: string;
  };
  viewerContext: {
    mode: 'public_session_viewer';
  };
  items: SituationshipDto[];
  capabilities: {
    canVote: boolean;
    canComment: boolean;
  };
  audience: {
    mode: 'session_link';
  };
}

export interface GetPublicVotingSessionResponseDto {
  data: PublicVotingSessionAggregateDto;
}

export interface SubmitVoteRequestDto {
  voterIdentity: string;
  voterName?: string | null;
  bestSituationshipId: string;
  worstSituationshipId: string;
  comment?: string | null;
}

export interface SubmitVoteResponseDto {
  data: {
    votingSessionId: string;
    accepted: true;
    votesRecorded: number;
    selections: {
      bestSituationshipId: string;
      worstSituationshipId: string;
    };
  };
}

export interface VoteResultDto {
  situationshipId: string;
  name: string;
  emoji: string | null;
  bestVotes: number;
  worstVotes: number;
  totalVotes: number;
  score: number;
  rank: number;
}

export interface VoteCommentDto {
  comment: string;
  createdAt: string;
  voteType: VoteKind;
  situationshipId: string;
  voterLabel: string | null;
}

export interface VotingResultsAggregateDto {
  session: VotingSessionDto;
  totalVotes: number;
  totalVoters: number;
  results: VoteResultDto[];
  comments: VoteCommentDto[];
}

export interface GetVotingResultsResponseDto {
  data: VotingResultsAggregateDto;
}
