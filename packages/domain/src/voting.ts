export type VotingSessionStatus = 'active' | 'expired' | 'closed';

export function resolveVotingSessionStatus(
  isActive: boolean,
  expiresAt: string,
  now: Date = new Date(),
): VotingSessionStatus {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
    return 'expired';
  }

  return isActive ? 'active' : 'closed';
}

export function normalizeVoterIdentity(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw new Error('Voter identity must be between 8 and 128 characters.');
  }

  return normalized;
}

export function validateVoteSelection(
  allowedSituationshipIds: string[],
  bestSituationshipId: string,
  worstSituationshipId: string,
): void {
  if (bestSituationshipId === worstSituationshipId) {
    throw new Error('Best and worst selections must be different.');
  }

  const allowed = new Set(allowedSituationshipIds);
  if (!allowed.has(bestSituationshipId) || !allowed.has(worstSituationshipId)) {
    throw new Error('Vote selections must exist in the shared situationship list.');
  }
}
