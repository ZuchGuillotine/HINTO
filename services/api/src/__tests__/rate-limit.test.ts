import { enforceRateLimit, resetRateLimits } from '../rate-limit';
import { AppError } from '../errors';

const rule = { name: 'test', limit: 3, windowMs: 1_000 };

beforeEach(() => resetRateLimits());

test('allows up to the limit inside the window and then rejects with 429', () => {
  enforceRateLimit(rule, 'ip-1', 1_000);
  enforceRateLimit(rule, 'ip-1', 1_100);
  enforceRateLimit(rule, 'ip-1', 1_200);
  expect(() => enforceRateLimit(rule, 'ip-1', 1_300)).toThrow(AppError);
  try {
    enforceRateLimit(rule, 'ip-1', 1_300);
  } catch (error) {
    expect((error as AppError).statusCode).toBe(429);
    expect((error as AppError).details?.retryAfterSeconds).toBe(1);
  }
});

test('keys are independent and the window slides', () => {
  enforceRateLimit(rule, 'ip-1', 1_000);
  enforceRateLimit(rule, 'ip-1', 1_000);
  enforceRateLimit(rule, 'ip-1', 1_000);
  expect(() => enforceRateLimit(rule, 'ip-2', 1_000)).not.toThrow();
  expect(() => enforceRateLimit(rule, 'ip-1', 2_001)).not.toThrow();
});
