import { IncomingMessage, ServerResponse } from 'node:http';

import { AppConfig, RequestContext } from './types.js';
import { sendJsonSuccess } from './http.js';

export function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  config: AppConfig,
): boolean {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? config.host}`);
  const path = url.pathname;

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
      status: 'scaffold-ready',
      nextRoutes: ['/v1/me', '/v1/me/situationships'],
    });
    return true;
  }

  return false;
}
