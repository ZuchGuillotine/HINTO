import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { loadConfig } from './config.js';
import { AppError, toErrorEnvelope } from './errors.js';
import { sendJsonError } from './http.js';
import { Logger } from './logger.js';
import { routeRequest } from './routes.js';
import { RequestContext } from './types.js';

const config = loadConfig();
const logger = new Logger(config);

function createRequestContext(): RequestContext {
  return {
    requestId: randomUUID(),
    startedAt: Date.now(),
  };
}

function handleNotFound(requestId: string): never {
  throw new AppError('not_found', 'Route not found', 404);
}

const server = createServer((request, response) => {
  const context = createRequestContext();
  response.setHeader('x-request-id', context.requestId);

  try {
    const handled = routeRequest(request, response, context, config);

    if (!handled) {
      handleNotFound(context.requestId);
    }
  } catch (error) {
    const { statusCode, body } = toErrorEnvelope(error, context.requestId);
    sendJsonError(response, statusCode, body);
    logger.error('request_failed', {
      requestId: context.requestId,
      path: request.url ?? '/',
      method: request.method ?? 'GET',
      statusCode,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - context.startedAt,
    });
    return;
  }

  logger.info('request_completed', {
    requestId: context.requestId,
    path: request.url ?? '/',
    method: request.method ?? 'GET',
    statusCode: response.statusCode,
    durationMs: Date.now() - context.startedAt,
  });
});

server.on('error', (error) => {
  logger.error('server_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

server.listen(config.port, config.host, () => {
  logger.info('server_started', {
    host: config.host,
    port: config.port,
    nodeEnv: config.nodeEnv,
  });
});
