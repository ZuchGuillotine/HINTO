import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { loadConfig } from './config.js';
import { toErrorEnvelope } from './errors.js';
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

const server = createServer((request, response) => {
  const context = createRequestContext();
  response.setHeader('x-request-id', context.requestId);

  routeRequest(request, response, context, config);

  response.on('finish', () => {
    logger.info('request_completed', {
      requestId: context.requestId,
      path: request.url ?? '/',
      method: request.method ?? 'GET',
      statusCode: response.statusCode,
      durationMs: Date.now() - context.startedAt,
    });
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
