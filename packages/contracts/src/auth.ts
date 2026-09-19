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

/**
 * Session payload returned by every route that establishes a session:
 * - POST /v1/auth/email/verify
 * - POST /v1/auth/refresh
 * - POST /v1/auth/apple
 */
export interface AuthSessionDto {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch seconds when the access token expires. */
  expiresAt: number | null;
  me: MeAggregateDto;
}

export interface AuthSessionResponseDto {
  data: AuthSessionDto;
}

export interface EmailOtpRequestDto {
  email: string;
}

export interface EmailOtpResponseDto {
  data: {
    sent: true;
    email: string;
  };
}

export interface EmailVerifyRequestDto {
  email: string;
  token: string;
}

export interface RefreshSessionRequestDto {
  refreshToken: string;
}

/**
 * Sign in with Apple. The client obtains an identity token from
 * ASAuthorizationAppleIDCredential (iOS) or Apple JS (web) and exchanges it here.
 * `nonce` is the raw nonce whose SHA-256 hash was passed to Apple, when used.
 */
export interface AppleSignInRequestDto {
  identityToken: string;
  nonce?: string | null;
  /** Apple only returns the name on first sign-in; forward it so the profile can be seeded. */
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
}
