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
