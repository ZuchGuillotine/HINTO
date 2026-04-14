import { MeAggregateDto, ProfilePrivacy } from './me.js';

export type CustomAuthProviderDto = 'snapchat' | 'tiktok';
export type CustomAuthPlatformDto = 'web' | 'mobile' | 'desktop';

export interface CreateDevelopmentSessionRequestDto {
  profileId?: string;
  username?: string;
  displayName?: string;
  email?: string | null;
  privacy?: ProfilePrivacy;
}

export interface CreateDevelopmentSessionResponseDto {
  data: {
    accessToken: string;
    me: MeAggregateDto;
    development: true;
  };
}

export interface StartCustomAuthRequestDto {
  clientRedirectUri: string;
  platform?: CustomAuthPlatformDto;
}

export interface StartCustomAuthResponseDto {
  data: {
    provider: CustomAuthProviderDto;
    authorizationUrl: string;
    expiresAt: string;
    platform: CustomAuthPlatformDto;
  };
}
