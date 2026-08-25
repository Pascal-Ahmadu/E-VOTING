import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> =
  global.__rateLimitBuckets ?? new Map<string, Bucket>();
if (!global.__rateLimitBuckets) global.__rateLimitBuckets = buckets;

interface Options {
  /** Identifier for the bucket (typically `route:ip` or `route:email`). */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * Adequate for a single-instance deployment (local dev or a single Node
 * server). For a serverless / multi-instance deployment, swap this for a
 * shared store such as Upstash Redis or Vercel KV — the call site stays the
 * same.
 */
export function checkRateLimit(opts: Options): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(opts.key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (bucket.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count++;
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
