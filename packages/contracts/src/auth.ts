import { MeAggregateDto, ProfilePrivacy } from './me.js';

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
