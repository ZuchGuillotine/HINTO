export type ViewerMode = 'owner' | 'authorized_viewer' | 'public_session_viewer';
export type AudienceMode = 'owner_only' | 'selected_viewers' | 'session_link';
export type SituationshipStatus = 'active' | 'archived';

export interface SituationshipState {
  situationshipId: string;
  ownerProfileId: string;
  rank: number;
  status: SituationshipStatus;
}

export interface ViewerContext {
  mode: ViewerMode;
  viewerProfileId?: string;
}

export interface AudiencePolicy {
  mode: AudienceMode;
  viewerProfileIds?: string[];
}

export interface SituationshipCapabilities {
  canEdit: boolean;
  canReorder: boolean;
  canVote: boolean;
}

export function resolveSituationshipCapabilities(
  viewer: ViewerContext,
): SituationshipCapabilities {
  if (viewer.mode === 'owner') {
    return {
      canEdit: true,
      canReorder: true,
      canVote: false,
    };
  }

  if (viewer.mode === 'authorized_viewer' || viewer.mode === 'public_session_viewer') {
    return {
      canEdit: false,
      canReorder: false,
      canVote: true,
    };
  }

  return {
    canEdit: false,
    canReorder: false,
    canVote: false,
  };
}

export function validateReorderRequest(
  current: SituationshipState[],
  orderedSituationshipIds: string[],
): void {
  const currentIds = current.map((item) => item.situationshipId);

  if (currentIds.length !== orderedSituationshipIds.length) {
    throw new Error('Reorder request must include every situationship exactly once.');
  }

  const uniqueIds = new Set(orderedSituationshipIds);
  if (uniqueIds.size !== orderedSituationshipIds.length) {
    throw new Error('Reorder request contains duplicate situationship IDs.');
  }

  const missingIds = currentIds.filter((id) => !uniqueIds.has(id));
  if (missingIds.length > 0) {
    throw new Error('Reorder request is missing one or more situationship IDs.');
  }
}

export function applySituationshipOrdering(
  current: SituationshipState[],
  orderedSituationshipIds: string[],
): SituationshipState[] {
  validateReorderRequest(current, orderedSituationshipIds);

  const currentById = new Map(current.map((item) => [item.situationshipId, item]));

  return orderedSituationshipIds.map((situationshipId, rank) => {
    const existing = currentById.get(situationshipId);
    if (!existing) {
      throw new Error(`Unknown situationship ID in reorder request: ${situationshipId}`);
    }

    return {
      ...existing,
      rank,
    };
  });
}
