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
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  privacy?: ProfilePrivacy;
}

export interface UpdateMeResponseDto {
  data: MeAggregateDto;
}
