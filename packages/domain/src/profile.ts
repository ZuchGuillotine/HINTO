export type ProfilePrivacy = 'public' | 'private' | 'mutuals_only';
export type SubscriptionTier = 'free' | 'premium' | 'unknown';

export interface ProfileState {
  profileId: string;
  privacy: ProfilePrivacy;
  subscriptionTier: SubscriptionTier;
}

export interface ProfileCapabilities {
  canEditProfile: boolean;
  canCreateSituationship: boolean;
  canUseAiCoach: boolean;
}

export function resolveProfileCapabilities(
  profile: ProfileState,
  options: {
    isSelf: boolean;
    aiCoachEnabled?: boolean;
  },
): ProfileCapabilities {
  return {
    canEditProfile: options.isSelf,
    canCreateSituationship: options.isSelf,
    canUseAiCoach: options.isSelf && Boolean(options.aiCoachEnabled),
  };
}

export function normalizeProfilePrivacy(value: string | null | undefined): ProfilePrivacy {
  if (value === 'public' || value === 'private' || value === 'mutuals_only') {
    return value;
  }

  return 'private';
}
