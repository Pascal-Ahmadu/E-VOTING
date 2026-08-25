import { NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-origin defense for state-changing requests. Browsers always send
 * the `Origin` header for non-safe methods. We require it to match the
 * request host. Combined with iron-session's SameSite=Lax cookie, this
 * blocks cross-site form posts even before the route handler runs.
 */
export function requireSameOrigin(req: Request): NextResponse | null {
  if (SAFE_METHODS.has(req.method)) return null;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    return NextResponse.json(
      { error: "Missing origin header" },
      { status: 403 },
    );
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (originHost !== host) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }
  return null;
}
