export type ProfilePrivacy = 'public' | 'private' | 'mutuals_only';
export type SubscriptionTier = 'free' | 'premium' | 'unknown';

export interface ProfileDto {
  profileId: string;
  username: string;
  displayName: string;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  privacy: ProfilePrivacy;
  subscriptionTier: SubscriptionTier;
  /** Self-reported age, null until the user confirms it during onboarding. */
  age: number | null;
  ageVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthIdentityDto {
  authUserId: string;
  profileId: string;
  primaryProvider: string | null;
  linkedProviders: string[];
  status: 'active' | 'pending' | 'disabled';
}

export interface MeCapabilitiesDto {
  canEditProfile: boolean;
  canCreateSituationship: boolean;
  canUseAiCoach: boolean;
}

export interface MeAggregateDto {
  profile: ProfileDto;
  auth: AuthIdentityDto;
  capabilities: MeCapabilitiesDto;
}

export interface GetMeResponseDto {
  data: MeAggregateDto;
}

export interface UpdateMeRequestDto {
  username?: string;
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  privacy?: ProfilePrivacy;
  /** Minimum accepted age is 16. */
  age?: number;
}

export interface UpdateMeResponseDto {
  data: MeAggregateDto;
}

/**
 * DELETE /v1/me
 * Permanently deletes the auth user; profile and all owned rows cascade.
 */
export interface DeleteMeResponseDto {
  data: {
    deleted: true;
    profileId: string;
  };
}
