import { IncomingMessage } from 'node:http';

import { AppError } from './errors.js';

const MAX_BODY_SIZE = 1_048_576; // 1 MB

/**
 * Reads and parses a JSON request body.
 */
export async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    request.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        request.destroy();
        reject(new AppError('payload_too_large', 'Request body too large', 413));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new AppError('validation_error', 'Request body must be a JSON object', 400));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new AppError('validation_error', 'Invalid JSON in request body', 400));
      }
    });

    request.on('error', (err) => {
      reject(new AppError('request_error', err.message, 400));
    });
  });
}
