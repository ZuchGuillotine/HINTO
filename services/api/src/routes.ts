import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from './types.js';
import { sendJsonSuccess, sendJsonError } from './http.js';
import { AppError, toErrorEnvelope } from './errors.js';
import { handleCreateDevelopmentSession } from './routes/dev.js';
import { handleGetMe, handlePatchMe } from './routes/profile.js';
import {
  handleListSituationships,
  handleCreateSituationship,
  handleUpdateSituationship,
  handleDeleteSituationship,
  handleReorderSituationships,
} from './routes/situationships.js';

/**
 * Extracts a path parameter from a pattern like /v1/me/situationships/:id.
 * Returns the :id segment or null if the path doesn't match.
 */
function matchSituationshipId(path: string): string | null {
  const match = path.match(/^\/v1\/me\/situationships\/([a-f0-9-]+)$/);
  return match ? match[1] : null;
}

async function routeAsync(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
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
        'GET  /v1/me',
        'PATCH /v1/me',
        'POST /v1/dev/session',
        'GET  /v1/me/situationships',
        'POST /v1/me/situationships',
        'PATCH /v1/me/situationships/:id',
        'DELETE /v1/me/situationships/:id',
        'PUT  /v1/me/situationships/order',
      ],
    });
    return true;
  }

  if (method === 'POST' && path === '/v1/dev/session') {
    await handleCreateDevelopmentSession(request, response, context, config);
    return true;
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
  config: AppConfig,
): void {
  routeAsync(request, response, context, config).then((handled) => {
    if (!handled) {
      const { statusCode, body } = toErrorEnvelope(
        new AppError('not_found', 'Route not found', 404),
        context.requestId,
      );
      sendJsonError(response, statusCode, body);
    }
  }).catch((error) => {
    const { statusCode, body } = toErrorEnvelope(error, context.requestId);
    sendJsonError(response, statusCode, body);
  });
}
