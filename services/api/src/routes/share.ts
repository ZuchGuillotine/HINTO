import { IncomingMessage, ServerResponse } from 'node:http';

import { readJsonBody } from '../body.js';
import { shouldUsePostgres } from '../db.js';
import { AppError } from '../errors.js';
import { sendJsonSuccess } from '../http.js';
import { resolveAuthenticatedUser } from '../middleware/auth.js';
import {
  createShareInvite,
  getFeedSubmissionByIdForOwner,
  getVotingSessionByIdForOwner,
  ShareInviteRow,
} from '../repositories/postgres-core.js';
import { buildSharePayload, ShareTargetType } from '../share.js';
import { AppConfig, RequestContext } from '../types.js';

function parseTargetType(value: unknown): ShareTargetType {
  if (
    value === 'voting_session' ||
    value === 'feed_submission' ||
    value === 'friend_invite'
  ) {
    return value;
  }

  throw new AppError(
    'validation_error',
    'targetType must be voting_session, feed_submission, or friend_invite',
    400,
  );
}

function parseChannel(value: unknown): ShareInviteRow['channel'] {
  if (
    value === 'sms' ||
    value === 'ios_share' ||
    value === 'web_share' ||
    value === 'copy_link' ||
    value === 'unknown'
  ) {
    return value;
  }

  return 'unknown';
}

function parseTargetId(value: unknown, required: boolean): string | null {
  const targetId = typeof value === 'string' ? value.trim() : '';
  if (!targetId && required) {
    throw new AppError('validation_error', 'targetId is required for this share target', 400);
  }
  return targetId || null;
}

function parseRecipientContactHmac(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return null;
  }
  if (!/^[a-f0-9]{32,128}$/iu.test(normalized)) {
    throw new AppError('validation_error', 'recipientContactHmac must be a hex HMAC', 400);
  }
  return normalized.toLowerCase();
}

export async function handleCreateShareInvite(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): Promise<void> {
  const authCtx = await resolveAuthenticatedUser(request, context, config);
  if (!shouldUsePostgres(config)) {
    throw new AppError('not_configured', 'Share invites require DATABASE_URL', 501);
  }

  const body = await readJsonBody(request);
  const targetType = parseTargetType(body.targetType);
  const targetId = parseTargetId(body.targetId, targetType !== 'friend_invite');
  const channel = parseChannel(body.channel);
  const recipientContactHmac = parseRecipientContactHmac(body.recipientContactHmac);

  let publicPath = '/friends/invite';

  if (targetType === 'voting_session') {
    const session = await getVotingSessionByIdForOwner(
      config,
      targetId as string,
      authCtx.user.profileId,
    );
    if (!session) {
      throw new AppError('not_found', 'Voting session not found', 404);
    }
    publicPath = `/vote/${session.invite_code}`;
  }

  if (targetType === 'feed_submission') {
    const submission = await getFeedSubmissionByIdForOwner(
      config,
      targetId as string,
      authCtx.user.profileId,
    );
    if (!submission) {
      throw new AppError('not_found', 'Rank feed post not found', 404);
    }
    publicPath = '/rank';
  }

  const invite = await createShareInvite(config, {
    inviterProfileId: authCtx.user.profileId,
    targetType,
    targetId,
    channel,
    recipientContactHmac,
  });

  const share = buildSharePayload(config, {
    targetType,
    publicPath,
    inviteToken: invite.invite_token,
  });

  sendJsonSuccess(response, 201, context.requestId, {
    invite: {
      inviteId: invite.id,
      inviteToken: invite.invite_token,
      targetType: invite.target_type,
      targetId: invite.target_id,
      channel: invite.channel,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
    },
    share,
  });
}
