import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { RequestContext } from '../../types';

/**
 * Creates a fake IncomingMessage for testing route handlers.
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);

  req.method = options.method ?? 'GET';
  req.url = options.url ?? '/';
  req.headers = {
    host: '127.0.0.1:4000',
    ...options.headers,
  };

  // If body is provided, simulate readable stream with the JSON payload
  if (options.body !== undefined) {
    const payload = Buffer.from(JSON.stringify(options.body));
    // Push data on next tick so event listeners can be attached first
    process.nextTick(() => {
      req.push(payload);
      req.push(null); // EOF
    });
  } else {
    process.nextTick(() => {
      req.push(null);
    });
  }

  return req;
}

/**
 * Creates a fake ServerResponse that captures the written output.
 */
export function createMockResponse(): ServerResponse & {
  _getStatusCode(): number;
  _getHeaders(): Record<string, string | string[]>;
  _getBody(): string;
  _getJson(): unknown;
} {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req) as ServerResponse & {
    _chunks: Buffer[];
    _getStatusCode(): number;
    _getHeaders(): Record<string, string | string[]>;
    _getBody(): string;
    _getJson(): unknown;
  };

  res._chunks = [];

  // Intercept write/end to capture output
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  res.write = function (chunk: unknown, ...args: unknown[]): boolean {
    if (chunk) {
      res._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return true;
  } as typeof res.write;

  res.end = function (chunk?: unknown, ...args: unknown[]): ServerResponse {
    if (chunk) {
      res._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    // Emit finish so listeners (like the server logger) fire
    if (!res.writableFinished) {
      res.emit('finish');
    }
    return res;
  } as typeof res.end;

  res._getStatusCode = () => res.statusCode;
  res._getHeaders = () => res.getHeaders() as Record<string, string | string[]>;
  res._getBody = () => Buffer.concat(res._chunks).toString('utf-8');
  res._getJson = () => JSON.parse(res._getBody());

  return res;
}

/**
 * Creates a standard RequestContext for tests.
 */
export function createTestContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: 'test-request-id',
    startedAt: Date.now(),
    ...overrides,
  };
}
