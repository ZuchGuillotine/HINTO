import { IncomingMessage } from 'node:http';

import { AppError } from './errors.js';

/**
 * Small in-memory sliding-window limiter. One ECS task holds one map, so
 * limits are per task, which is enough to blunt credential stuffing, OTP
 * bombing, and vote spam at MVP scale. Swap for a shared store (ElastiCache)
 * when running more than a couple of tasks.
 */

interface Bucket {
  hits: number[];
}

export interface RateLimitRule {
  /** Identifies the bucket family in error messages and metrics. */
  name: string;
  /** Maximum hits allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 50_000;

export function clientIpFromRequest(request: IncomingMessage): string {
  // The ALB sets x-forwarded-for; the first entry is the client.
  const forwarded = request.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(',')[0]?.trim();
  return first || request.socket.remoteAddress || 'unknown';
}

/**
 * Records a hit for `key` under `rule` and throws 429 when the window is full.
 */
export function enforceRateLimit(rule: RateLimitRule, key: string, now = Date.now()): void {
  const bucketKey = `${rule.name}:${key}`;
  const windowStart = now - rule.windowMs;
  const bucket = buckets.get(bucketKey) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((timestamp) => timestamp > windowStart);

  if (bucket.hits.length >= rule.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.hits[0] + rule.windowMs - now) / 1000),
    );
    throw new AppError('rate_limited', 'Too many requests. Please slow down.', 429, {
      retryAfterSeconds,
    });
  }

  bucket.hits.push(now);
  buckets.set(bucketKey, bucket);

  if (buckets.size > MAX_TRACKED_KEYS) {
    // Drop the oldest tracked keys rather than growing without bound.
    const excess = buckets.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const trackedKey of buckets.keys()) {
      buckets.delete(trackedKey);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}

export const AUTH_RATE_LIMIT: RateLimitRule = { name: 'auth', limit: 20, windowMs: 15 * 60_000 };
/** Refresh is separate so brute-force sign-in attempts from a shared IP cannot lock out existing sessions. */
export const REFRESH_RATE_LIMIT: RateLimitRule = { name: 'refresh', limit: 60, windowMs: 15 * 60_000 };
export const PUBLIC_VOTE_RATE_LIMIT: RateLimitRule = {
  name: 'public_vote',
  limit: 30,
  windowMs: 10 * 60_000,
};
export const AI_MESSAGE_RATE_LIMIT: RateLimitRule = {
  name: 'ai_message',
  limit: 10,
  windowMs: 60_000,
};
