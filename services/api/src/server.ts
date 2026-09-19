import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { assertConfigValid, ConfigError, loadConfig } from './config.js';
import { Logger } from './logger.js';
import { routeRequest } from './routes.js';
import { AppConfig, RequestContext } from './types.js';

const config = loadConfig();
const logger = new Logger(config);

try {
  assertConfigValid(config);
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

/**
 * Resolves the CORS origin to echo back for this request, or null when the
 * request origin is not in the allowlist. `*` (non-production only) allows any.
 */
export function resolveCorsOrigin(request: IncomingMessage, appConfig: AppConfig): string | null {
  const origin = request.headers.origin;
  if (appConfig.corsAllowOrigins.includes('*')) {
    return origin ?? '*';
  }
  if (!origin) {
    return null;
  }
  return appConfig.corsAllowOrigins.includes(origin) ? origin : null;
}

function applyCommonHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext
): void {
  response.setHeader('x-request-id', context.requestId);
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('cache-control', 'no-store');

  const corsOrigin = resolveCorsOrigin(request, config);
  if (corsOrigin) {
    response.setHeader('access-control-allow-origin', corsOrigin);
    response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    response.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
    response.setHeader('access-control-max-age', '600');
  }
  response.setHeader('vary', 'Origin');
}

const server = createServer((request, response) => {
  const context = createRequestContext();
  applyCommonHeaders(request, response, context);

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

// Keep slow clients from holding sockets forever.
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 65_000;

server.on('error', error => {
  logger.error('server_failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});

function shutdown(signal: string): void {
  logger.info('server_stopping', { signal });
  server.close(() => {
    logger.info('server_stopped', {});
    process.exit(0);
  });
  // Force exit if connections refuse to drain.
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', reason => {
  logger.error('unhandled_rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

server.listen(config.port, config.host, () => {
  logger.info('server_started', {
    host: config.host,
    port: config.port,
    nodeEnv: config.nodeEnv,
    devAuthEnabled: config.enableDevAuth,
    corsAllowOrigins: config.corsAllowOrigins,
  });
});
