/**
 * Minimal in-process sliding-window rate limiter.
 *
 * cPanel deployments run a single Node process per application, so an
 * in-memory limiter is sufficient for authentication throttling. If the app
 * is ever scaled to multiple processes this can be swapped for a shared
 * store without changing call sites.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterMs: 0,
  };
}

/** Test helper: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}