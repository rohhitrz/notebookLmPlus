import { PublicError } from "@/lib/errors";

// Per-user throttle for endpoints that spend real money (LLM completions, web
// search, image generation). Without it, one signed-in account can loop a
// request and run up an unbounded OpenAI/Tavily bill.
//
// Deliberately in-memory: no extra infrastructure, and it stops the common cases
// (a stuck retry loop, a held-down button, an impatient double-click storm)
// because those hit the same warm instance. It is NOT a hard guarantee — each
// serverless instance keeps its own counters, so a determined attacker spreading
// requests across cold starts can exceed these limits. For strict enforcement,
// back this with a shared store (e.g. Upstash Redis) behind the same interface.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Bound the map so it can't grow without limit on a long-lived instance.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** Distinct name so different endpoints don't share a counter. */
  name: string;
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  // Web search + streamed completion per chapter.
  chapter: { name: "chapter", limit: 30, windowMs: 60 * 60 * 1000 },
  // Image generation is the priciest call per request.
  chapterImage: { name: "chapter-image", limit: 20, windowMs: 60 * 60 * 1000 },
  // Source summarization + roadmap drafting over every source.
  roadmap: { name: "roadmap", limit: 10, windowMs: 60 * 60 * 1000 },
  // Retrieval + rerank + completion per message.
  chat: { name: "chat", limit: 120, windowMs: 60 * 60 * 1000 },
  // Cheap single structured call, but still an LLM round-trip.
  scope: { name: "scope", limit: 30, windowMs: 60 * 60 * 1000 },
  // Long multi-call generations (TTS / many slide batches).
  studio: { name: "studio", limit: 10, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

/**
 * Records one use of `rule` for `userId`, throwing a PublicError once the
 * allowance is spent. Call after authenticating, before doing paid work.
 */
export function enforceRateLimit(userId: string, rule: RateLimitRule): void {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const key = `${rule.name}:${userId}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return;
  }

  if (existing.count >= rule.limit) {
    const minutes = Math.max(1, Math.ceil((existing.resetAt - now) / 60_000));
    throw new PublicError(
      `You've hit the limit for this action. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }

  existing.count += 1;
}
