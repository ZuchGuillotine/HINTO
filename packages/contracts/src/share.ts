export type ShareTargetType = 'voting_session' | 'feed_submission' | 'friend_invite';

export interface ShareCopyOptionDto {
  copyId: string;
  text: string;
  fullText: string;
}

export interface SharePayloadDto {
  targetType: ShareTargetType;
  shareUrl: string;
  appStoreUrl: string | null;
  copyOptions: ShareCopyOptionDto[];
}

export type ShareChannelDto = 'sms' | 'ios_share' | 'web_share' | 'copy_link' | 'unknown';

export interface CreateShareInviteRequestDto {
  targetType: ShareTargetType;
  targetId?: string | null;
  channel?: ShareChannelDto;
  recipientContactHmac?: string | null;
}

export interface ShareInviteDto {
  inviteId: string;
  inviteToken: string;
  targetType: ShareTargetType;
  targetId: string | null;
  channel: ShareChannelDto;
  expiresAt: string;
  createdAt: string;
}

export interface CreateShareInviteResponseDto {
  data: {
    invite: ShareInviteDto;
    share: SharePayloadDto;
  };
}
