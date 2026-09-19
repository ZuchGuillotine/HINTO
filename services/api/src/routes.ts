import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from './types.js';
import { sendJsonSuccess, sendJsonError } from './http.js';
import { AppError, toErrorEnvelope } from './errors.js';
import {
  handleCustomProviderCallback,
  handleCustomProviderStart,
  matchCustomAuthProvider,
} from './routes/auth-providers.js';
import {
  handleAppleSignIn,
  handleEmailOtp,
  handleEmailVerify,
  handleRefreshToken,
} from './routes/auth.js';
import { handleCreateDevelopmentSession } from './routes/dev.js';
import { handleDeleteMe, handleGetMe, handlePatchMe } from './routes/profile.js';
import {
  handleCreateBlock,
  handleCreateReport,
  handleDeleteBlock,
  handleListBlocks,
  matchBlockProfileId,
} from './routes/moderation.js';
import {
  handleCreateAiConversation,
  handleListAiConversations,
  handleListAiMessages,
  handleSendAiMessage,
  matchAiConversationPath,
} from './routes/ai.js';
import {
  handleListSituationships,
  handleCreateSituationship,
  handleUpdateSituationship,
  handleDeleteSituationship,
  handleReorderSituationships,
} from './routes/situationships.js';
import {
  handleCreateVotingSession,
  handleExpireVotingSession,
  handleGetPublicVotingSession,
  handleGetVotingResults,
  handleListVotingSessions,
  handleSubmitVote,
} from './routes/voting.js';

/**
 * Extracts a path parameter from a pattern like /v1/me/situationships/:id.
 * Returns the :id segment or null if the path doesn't match.
 */
function matchSituationshipId(path: string): string | null {
  const match = path.match(/^\/v1\/me\/situationships\/([a-f0-9-]+)$/);
  return match ? match[1] : null;
}

function matchOwnerVotingAction(
  path: string
): { votingSessionId: string; action: 'expire' | 'results' } | null {
  const match = path.match(/^\/v1\/me\/voting-sessions\/([a-f0-9-]+)\/(expire|results)$/);
  if (!match) {
    return null;
  }

  return {
    votingSessionId: match[1],
    action: match[2] as 'expire' | 'results',
  };
}

function matchPublicVotingPath(
  path: string
): { inviteCode: string; action: 'session' | 'votes' } | null {
  const votesMatch = path.match(/^\/v1\/voting-sessions\/([A-Za-z0-9]+)\/votes$/);
  if (votesMatch) {
    return {
      inviteCode: votesMatch[1],
      action: 'votes',
    };
  }

  const sessionMatch = path.match(/^\/v1\/voting-sessions\/([A-Za-z0-9]+)$/);
  if (sessionMatch) {
    return {
      inviteCode: sessionMatch[1],
      action: 'session',
    };
  }

  return null;
}

async function routeAsync(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): Promise<boolean> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? config.host}`);
  const path = url.pathname;

  // ── Health & discovery (sync, no auth) ─────────────────────

  if (method === 'GET' && path === '/health') {
    sendJsonSuccess(response, 200, context.requestId, {
      ok: true,
      service: config.apiName,
      version: 'v1',
      environment: config.nodeEnv,
    });
    return true;
  }

  if (method === 'GET' && path === '/v1/health') {
    sendJsonSuccess(response, 200, context.requestId, {
      ok: true,
      api: 'v1',
      service: config.apiName,
    });
    return true;
  }

  if (method === 'GET' && path === '/v1') {
    sendJsonSuccess(response, 200, context.requestId, {
      api: 'v1',
      status: 'active',
      routes: [
        'POST /v1/auth/email/otp',
        'POST /v1/auth/email/verify',
        'POST /v1/auth/refresh',
        'POST /v1/auth/apple',
        'POST /v1/auth/providers/:provider/start',
        'GET  /v1/auth/providers/:provider/callback',
        'GET  /v1/me',
        'PATCH /v1/me',
        'DELETE /v1/me',
        ...(config.enableDevAuth ? ['POST /v1/dev/session'] : []),
        'GET  /v1/me/situationships',
        'POST /v1/me/situationships',
        'PATCH /v1/me/situationships/:id',
        'DELETE /v1/me/situationships/:id',
        'PUT  /v1/me/situationships/order',
        'GET  /v1/me/voting-sessions',
        'POST /v1/me/voting-sessions',
        'POST /v1/me/voting-sessions/:id/expire',
        'GET  /v1/me/voting-sessions/:id/results',
        'GET  /v1/voting-sessions/:inviteCode',
        'POST /v1/voting-sessions/:inviteCode/votes',
        'POST /v1/reports',
        'GET  /v1/me/blocks',
        'POST /v1/me/blocks',
        'DELETE /v1/me/blocks/:profileId',
        'GET  /v1/me/ai/conversations',
        'POST /v1/me/ai/conversations',
        'GET  /v1/me/ai/conversations/:id/messages',
        'POST /v1/me/ai/conversations/:id/messages',
      ],
    });
    return true;
  }

  if (method === 'POST' && path === '/v1/dev/session') {
    await handleCreateDevelopmentSession(request, response, context, config);
    return true;
  }

  // ── Auth routes (no bearer token required) ──────────────────

  if (method === 'POST' && path === '/v1/auth/email/otp') {
    await handleEmailOtp(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/auth/email/verify') {
    await handleEmailVerify(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/auth/refresh') {
    await handleRefreshToken(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/auth/apple') {
    await handleAppleSignIn(request, response, context, config);
    return true;
  }

  const customAuthProvider = matchCustomAuthProvider(path);
  if (customAuthProvider) {
    if (method === 'POST' && customAuthProvider.action === 'start') {
      await handleCustomProviderStart(
        request,
        response,
        context,
        config,
        customAuthProvider.provider
      );
      return true;
    }

    if (method === 'GET' && customAuthProvider.action === 'callback') {
      await handleCustomProviderCallback(
        request,
        response,
        context,
        config,
        customAuthProvider.provider
      );
      return true;
    }
  }

  // ── Profile routes (authenticated) ─────────────────────────

  if (method === 'GET' && path === '/v1/me') {
    await handleGetMe(request, response, context, config);
    return true;
  }

  if (method === 'PATCH' && path === '/v1/me') {
    await handlePatchMe(request, response, context, config);
    return true;
  }

  if (method === 'DELETE' && path === '/v1/me') {
    await handleDeleteMe(request, response, context, config);
    return true;
  }

  // ── Moderation routes (authenticated) ──────────────────────

  if (method === 'POST' && path === '/v1/reports') {
    await handleCreateReport(request, response, context, config);
    return true;
  }

  if (method === 'GET' && path === '/v1/me/blocks') {
    await handleListBlocks(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/me/blocks') {
    await handleCreateBlock(request, response, context, config);
    return true;
  }

  const blockProfileId = matchBlockProfileId(path);
  if (blockProfileId && method === 'DELETE') {
    await handleDeleteBlock(request, response, context, config, blockProfileId);
    return true;
  }

  // ── AI coach routes (authenticated) ────────────────────────

  if (method === 'GET' && path === '/v1/me/ai/conversations') {
    await handleListAiConversations(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/me/ai/conversations') {
    await handleCreateAiConversation(request, response, context, config);
    return true;
  }

  const aiConversationPath = matchAiConversationPath(path);
  if (aiConversationPath) {
    if (method === 'GET') {
      await handleListAiMessages(
        request,
        response,
        context,
        config,
        aiConversationPath.conversationId
      );
      return true;
    }
    if (method === 'POST') {
      await handleSendAiMessage(
        request,
        response,
        context,
        config,
        aiConversationPath.conversationId
      );
      return true;
    }
  }

  // ── Situationship routes (authenticated) ───────────────────

  if (method === 'GET' && path === '/v1/me/situationships') {
    await handleListSituationships(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/me/situationships') {
    await handleCreateSituationship(request, response, context, config);
    return true;
  }

  if (method === 'PUT' && path === '/v1/me/situationships/order') {
    await handleReorderSituationships(request, response, context, config);
    return true;
  }

  if (method === 'GET' && path === '/v1/me/voting-sessions') {
    await handleListVotingSessions(request, response, context, config);
    return true;
  }

  if (method === 'POST' && path === '/v1/me/voting-sessions') {
    await handleCreateVotingSession(request, response, context, config);
    return true;
  }

  // Parameterized: /v1/me/situationships/:id
  const situationshipId = matchSituationshipId(path);
  if (situationshipId) {
    if (method === 'PATCH') {
      await handleUpdateSituationship(request, response, context, config, situationshipId);
      return true;
    }
    if (method === 'DELETE') {
      await handleDeleteSituationship(request, response, context, config, situationshipId);
      return true;
    }
  }

  const ownerVotingAction = matchOwnerVotingAction(path);
  if (ownerVotingAction) {
    if (method === 'POST' && ownerVotingAction.action === 'expire') {
      await handleExpireVotingSession(
        request,
        response,
        context,
        config,
        ownerVotingAction.votingSessionId
      );
      return true;
    }

    if (method === 'GET' && ownerVotingAction.action === 'results') {
      await handleGetVotingResults(
        request,
        response,
        context,
        config,
        ownerVotingAction.votingSessionId
      );
      return true;
    }
  }

  const publicVotingPath = matchPublicVotingPath(path);
  if (publicVotingPath) {
    if (method === 'GET' && publicVotingPath.action === 'session') {
      await handleGetPublicVotingSession(
        request,
        response,
        context,
        config,
        publicVotingPath.inviteCode
      );
      return true;
    }

    if (method === 'POST' && publicVotingPath.action === 'votes') {
      await handleSubmitVote(request, response, context, config, publicVotingPath.inviteCode);
      return true;
    }
  }

  return false;
}

/**
 * Top-level route dispatcher.
 * Handles both sync health routes and async authenticated routes.
 */
export function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig
): void {
  routeAsync(request, response, context, config)
    .then(handled => {
      if (!handled) {
        const { statusCode, body } = toErrorEnvelope(
          new AppError('not_found', 'Route not found', 404),
          context.requestId
        );
        sendJsonError(response, statusCode, body);
      }
    })
    .catch(error => {
      const { statusCode, body } = toErrorEnvelope(error, context.requestId);
      sendJsonError(response, statusCode, body);
    });
}
