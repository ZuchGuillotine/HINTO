import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { assertProductionConfig, ConfigError, loadConfig } from './config.js';
import { resolveCorsAllowOrigin } from './cors.js';
import { Logger } from './logger.js';
import { routeRequest } from './routes.js';
import { RequestContext } from './types.js';

const config = loadConfig();
const logger = new Logger(config);

try {
  assertProductionConfig(config);
} catch (error) {
  logger.error('config_invalid', {
    error: error instanceof ConfigError ? error.message : String(error),
  });
  process.exit(1);
}

function createRequestContext(): RequestContext {
  return {
    requestId: randomUUID(),
    startedAt: Date.now(),
  };
}

const server = createServer((request, response) => {
  const context = createRequestContext();
  const corsAllowOrigin = resolveCorsAllowOrigin(
    config.corsAllowOrigin,
    Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin,
  );
  response.setHeader('x-request-id', context.requestId);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('access-control-allow-origin', corsAllowOrigin);
  response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  response.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
  response.setHeader('vary', 'Origin');

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.end();
    return;
  }

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

// Keep slow or idle clients from holding ECS task sockets forever.
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
// Must exceed the ALB idle timeout (60s) to avoid 502s on keep-alive reuse.
server.keepAliveTimeout = 65_000;

function shutdown(signal: string): void {
  logger.info('server_stopping', { signal });
  server.close(() => {
    logger.info('server_stopped', {});
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
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
