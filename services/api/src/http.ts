import { ServerResponse } from 'node:http';

import { JsonErrorEnvelope, JsonSuccessEnvelope } from './types.js';

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: JsonSuccessEnvelope<unknown> | JsonErrorEnvelope,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export function sendJsonSuccess<T>(
  response: ServerResponse,
  statusCode: number,
  requestId: string,
  data: T,
): void {
  writeJson(response, statusCode, {
    data,
    meta: { requestId },
  });
}

export function sendJsonError(
  response: ServerResponse,
  statusCode: number,
  body: JsonErrorEnvelope,
): void {
  writeJson(response, statusCode, body);
}
