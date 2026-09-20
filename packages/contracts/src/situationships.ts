export type ViewerMode = 'owner' | 'authorized_viewer' | 'public_session_viewer';
export type AudienceMode = 'owner_only' | 'selected_viewers' | 'session_link';
export type SituationshipStatus = 'active' | 'archived';

export interface SituationshipDto {
  situationshipId: string;
  ownerProfileId: string;
  name: string;
  emoji: string | null;
  category: string | null;
  description: string | null;
  rank: number;
  status: SituationshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SituationshipCapabilitiesDto {
  canEdit: boolean;
  canReorder: boolean;
  canVote: boolean;
}

export interface AudienceSummaryDto {
  mode: AudienceMode;
  viewerProfileIds?: string[];
}

export interface ViewerContextDto {
  mode: ViewerMode;
  viewerProfileId?: string;
}

export interface SituationshipListAggregateDto {
  ownerProfile: {
    profileId: string;
    username: string;
    displayName: string;
  };
  viewerContext: ViewerContextDto;
  items: SituationshipDto[];
  ordering: {
    orderedSituationshipIds: string[];
  };
  capabilities: SituationshipCapabilitiesDto;
  audience: AudienceSummaryDto;
}

export interface FeedOwnerProfileDto {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FeedSubmissionDto {
  body: string | null;
  imageUrl: string | null;
  expiresAt: string;
  status: 'active' | 'concluded';
  createdAt: string;
  updatedAt: string;
}

export interface FeedVoteSummaryDto {
  bestFitCount: number;
  notTheOneCount: number;
  totalCount: number;
}

export interface FeedSubmissionCommentDto {
  commentId: string;
  parentCommentId?: string | null;
  voterProfile: FeedOwnerProfileDto;
  voteType?: 'best_fit' | 'not_the_one' | null;
  voterVoteCount: number;
  comment: string;
  createdAt: string;
}

export interface FeedItemDto {
  feedItemId: string;
  submissionId?: string | null;
  ownerProfile: FeedOwnerProfileDto;
  viewerContext: ViewerContextDto;
  situationship: SituationshipDto;
  submission?: FeedSubmissionDto | null;
  voteSummary?: FeedVoteSummaryDto | null;
  viewerVote?: 'best_fit' | 'not_the_one' | null;
  viewerVoteCount?: number;
  viewerVoteSummary?: FeedVoteSummaryDto;
  comments?: FeedSubmissionCommentDto[];
}

export interface FriendsFeedAggregateDto {
  viewerProfileId: string;
  items: FeedItemDto[];
}

export interface GetFriendsFeedResponseDto {
  data: FriendsFeedAggregateDto;
}

export interface CreateFeedSubmissionRequestDto {
  situationshipId: string;
  body?: string | null;
  expiresInHours: number;
}

export interface VoteOnFeedSubmissionRequestDto {
  voteType: 'best_fit' | 'not_the_one';
  comment?: string | null;
  count?: number;
}

export interface CreateFeedSubmissionCommentRequestDto {
  comment: string;
  parentCommentId?: string | null;
}

export interface VoteOnFeedSubmissionResponseDto {
  data: {
    vote: {
      voteId: string;
      submissionId: string;
      voterProfileId: string;
      voteType: 'best_fit' | 'not_the_one';
      voterVoteCount: number;
      votesCast: number;
      comment: string | null;
      createdAt: string;
    };
  };
}

export interface CreateFeedSubmissionCommentResponseDto {
  data: {
    comment: FeedSubmissionCommentDto;
  };
}

export interface GetSituationshipsResponseDto {
  data: SituationshipListAggregateDto;
}

export interface CreateSituationshipRequestDto {
  name: string;
  emoji?: string | null;
  category?: string | null;
  description?: string | null;
}

export interface UpdateSituationshipRequestDto {
  name?: string;
  emoji?: string | null;
  category?: string | null;
  description?: string | null;
  status?: SituationshipStatus;
}

export interface SituationshipMutationResponseDto {
  data: {
    situationship: SituationshipDto;
  };
}

export interface DeleteSituationshipResponseDto {
  data: {
    situationshipId: string;
    deleted: true;
  };
}

export interface ReorderSituationshipsRequestDto {
  orderedSituationshipIds: string[];
}

export interface ReorderSituationshipsResponseDto {
  data: {
    ordering: {
      orderedSituationshipIds: string[];
    };
    items: SituationshipDto[];
  };
}
