export interface FriendProfileSummaryDto {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export type FriendshipStatusDto = 'pending' | 'accepted' | 'rejected' | 'declined' | 'blocked';
export type FriendshipDirectionDto = 'incoming' | 'outgoing' | 'mutual';

export interface FriendshipDto {
  friendshipId: string;
  status: FriendshipStatusDto;
  direction: FriendshipDirectionDto;
  otherProfile: FriendProfileSummaryDto;
  requestedAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface FriendsAggregateDto {
  viewerProfileId: string;
  friends: FriendshipDto[];
  incomingRequests: FriendshipDto[];
  outgoingRequests: FriendshipDto[];
}

export interface GetFriendsResponseDto {
  data: FriendsAggregateDto;
}

export interface GetFriendRequestsResponseDto {
  data: {
    viewerProfileId: string;
    incomingRequests: FriendshipDto[];
    outgoingRequests: FriendshipDto[];
  };
}

export interface CreateFriendRequestRequestDto {
  addresseeProfileId?: string | null;
  username?: string | null;
}

export interface FriendRequestMutationResponseDto {
  data: {
    friendship: unknown;
    acceptedIncomingRequest?: boolean;
  };
}

export interface DeleteFriendResponseDto {
  data: {
    friendProfileId: string;
    removed: true;
  };
}

export type FriendSuggestionSourceDto =
  | 'contacts'
  | 'mutual_friend'
  | 'shared_invite'
  | 'shared_voter'
  | 'provider_link';

export interface FriendSuggestionDto {
  suggestionId: string;
  source: FriendSuggestionSourceDto;
  reasonCode: string;
  score: number;
  mutualCount: number;
  profile: FriendProfileSummaryDto;
  createdAt: string;
  expiresAt: string;
}

export interface GetFriendSuggestionsResponseDto {
  data: {
    viewerProfileId: string;
    suggestions: FriendSuggestionDto[];
  };
}

export interface DismissFriendSuggestionResponseDto {
  data: {
    suggestionId: string;
    dismissed: true;
  };
}
