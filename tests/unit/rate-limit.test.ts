import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit then blocks", () => {
    expect(checkRateLimit("key", 3, 1000).allowed).toBe(true);
    expect(checkRateLimit("key", 3, 1000).allowed).toBe(true);
    expect(checkRateLimit("key", 3, 1000).allowed).toBe(true);

    const blocked = checkRateLimit("key", 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets once the window elapses", () => {
    checkRateLimit("key", 1, 1000);
    expect(checkRateLimit("key", 1, 1000).allowed).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("key", 1, 1000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    checkRateLimit("a", 1, 1000);
    expect(checkRateLimit("a", 1, 1000).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 1000).allowed).toBe(true);
  });
});