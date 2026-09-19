/**
 * Sliding-window rate limits for Vercel.
 * Prefer Upstash Redis when configured; fall back to in-process memory for local dev.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createMemoryKv, type KvLike } from "./kv";

export type RateLimitBucket = "invent" | "compose" | "fetch";

export type RateLimitConfig = {
  max: number;
  /** Sliding window length in ms */
  windowMs: number;
};

/** Per-endpoint budgets — invent is the expensive Haiku path. */
export const RATE_LIMITS: Record<RateLimitBucket, RateLimitConfig> = {
  invent: { max: 10, windowMs: 60 * 60_000 }, // 10 / hour
  compose: { max: 60, windowMs: 60 * 60_000 }, // 60 / hour
  fetch: { max: 30, windowMs: 60 * 60_000 }, // 30 / hour
};

export type RateLimitResult =
  | { allowed: true; pending?: Promise<unknown> }
  | {
      allowed: false;
      status: 429 | 403;
      retryAfter: number;
      code: "rate_limit" | "blocked";
      error: string;
      pending?: Promise<unknown>;
    };

const memoryKv = createMemoryKv();
const upstashLimiters = new Map<RateLimitBucket, Ratelimit>();

function hasUpstash(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function upstashLimiter(bucket: RateLimitBucket): Ratelimit {
  const existing = upstashLimiters.get(bucket);
  if (existing) return existing;

  const config = RATE_LIMITS[bucket];
  const windowSec = Math.max(1, Math.round(config.windowMs / 1000));
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(config.max, `${windowSec} s`),
    prefix: `filelathe:${bucket}`,
    analytics: true,
  });
  upstashLimiters.set(bucket, limiter);
  return limiter;
}

function kvTtlSeconds(windowMs: number): number {
  return Math.max(60, Math.ceil(windowMs / 1000) + 10);
}

async function enforceMemoryLimit(
  kv: KvLike,
  bucket: RateLimitBucket,
  clientKey: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const bucketKey = `rl:${bucket}:${clientKey}`;
  const raw = await kv.get(bucketKey);
  let timestamps: number[] = [];
  if (raw) {
    try {
      timestamps = JSON.parse(raw) as number[];
    } catch {
      timestamps = [];
    }
  }

  const valid = timestamps.filter((ts) => ts > windowStart);
  if (valid.length >= config.max) {
    const oldest = valid[0] ?? now;
    const retryAfter = Math.max(
      1,
      Math.ceil((oldest + config.windowMs - now) / 1000),
    );
    return {
      allowed: false,
      status: 429,
      retryAfter,
      code: "rate_limit",
      error: `Rate limit exceeded for ${bucket} — try again in ${retryAfter}s.`,
    };
  }

  valid.push(now);
  await kv.put(bucketKey, JSON.stringify(valid), {
    expirationTtl: kvTtlSeconds(config.windowMs),
  });
  return { allowed: true };
}

/**
 * Enforce a sliding-window limit for the given API bucket.
 * Uses Upstash on Vercel when env is set; otherwise in-memory (local only).
 */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  clientKey: string,
  config: RateLimitConfig = RATE_LIMITS[bucket],
): Promise<RateLimitResult> {
  if (hasUpstash()) {
    const result = await upstashLimiter(bucket).limit(`${bucket}:${clientKey}`);
    if (!result.success) {
      const retryAfter = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000),
      );
      return {
        allowed: false,
        status: 429,
        retryAfter,
        code: "rate_limit",
        error: `Rate limit exceeded for ${bucket} — try again in ${retryAfter}s.`,
        pending: result.pending,
      };
    }
    return { allowed: true, pending: result.pending };
  }

  return enforceMemoryLimit(memoryKv, bucket, clientKey, config);
}

/** Client identity for rate keys — prefer proxy / Vercel headers. */
export function clientKeyFromHeaders(
  headers: Headers | { get(name: string): string | null | undefined },
): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  return "local";
}
