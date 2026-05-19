import { AppConfig } from './types.js';

export type ShareTargetType = 'voting_session' | 'feed_submission' | 'friend_invite';

export interface ShareCopyOption {
  copyId: string;
  text: string;
  fullText: string;
}

export interface SharePayload {
  targetType: ShareTargetType;
  shareUrl: string;
  appStoreUrl: string | null;
  copyOptions: ShareCopyOption[];
}

const VOTING_COPY = [
  { copyId: 'settle-this', text: 'Settle this for me: Not it or him?' },
  { copyId: 'honestly-cant', text: "Honestly I can't even. Vote on this for me." },
  { copyId: 'be-honest', text: 'Be honest. Who is Best Fit and who is Not the One?' },
  { copyId: 'group-chat', text: 'This needs group chat energy. Vote on my ranking.' },
  { copyId: 'quick-vote', text: 'Quick vote. I need a second read.' },
] as const;

const FEED_COPY = [
  { copyId: 'rank-feed-vote', text: 'Vote on this HINTO post for me.' },
  { copyId: 'need-verdict', text: 'I need a verdict on this one.' },
  { copyId: 'tell-me-straight', text: 'Tell me straight: Best Fit or Not the One?' },
  { copyId: 'cant-decide', text: "I can't decide. Vote before this closes." },
  { copyId: 'private-poll', text: 'Private poll. I need your honest vote.' },
] as const;

const FRIEND_COPY = [
  { copyId: 'add-me', text: 'Add me on HINTO.' },
  { copyId: 'join-my-list', text: 'Join HINTO so I can send you the ranking tea.' },
  { copyId: 'need-you-here', text: 'I need you on HINTO for this.' },
] as const;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '');
}

function appendInviteToken(path: string, inviteToken?: string | null): string {
  if (!inviteToken) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}i=${encodeURIComponent(inviteToken)}`;
}

function optionsForTarget(targetType: ShareTargetType) {
  if (targetType === 'feed_submission') return FEED_COPY;
  if (targetType === 'friend_invite') return FRIEND_COPY;
  return VOTING_COPY;
}

function fullShareText(text: string, shareUrl: string, appStoreUrl?: string): string {
  if (appStoreUrl) {
    return `${text}\n${shareUrl}\nGet HINTO: ${appStoreUrl}`;
  }
  return `${text}\n${shareUrl}`;
}

export function buildSharePayload(
  config: AppConfig,
  input: {
    targetType: ShareTargetType;
    publicPath: string;
    inviteToken?: string | null;
  },
): SharePayload {
  const baseUrl = trimTrailingSlash(config.webAppUrl);
  const shareUrl = `${baseUrl}${appendInviteToken(input.publicPath, input.inviteToken)}`;
  const appStoreUrl = config.iosAppStoreUrl ?? null;

  return {
    targetType: input.targetType,
    shareUrl,
    appStoreUrl,
    copyOptions: optionsForTarget(input.targetType).map((option) => ({
      ...option,
      fullText: fullShareText(option.text, shareUrl, config.iosAppStoreUrl),
    })),
  };
}
