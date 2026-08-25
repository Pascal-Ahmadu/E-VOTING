import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

interface AdminSessionData {
  adminId?: string;
}

interface VoterSessionData {
  voterId?: string;
}

interface PlatformSessionData {
  platformAdminId?: string;
}

const ADMIN_COOKIE = "evoting_admin_session";
const VOTER_COOKIE = "evoting_voter_session";
const PLATFORM_COOKIE = "evoting_platform_session";

const PUBLIC_ADMIN_PATHS = ["/admin/sign-in", "/admin/change-password"];

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** The live results dashboard of one organisation: /o/{slug}/dashboard */
function dashboardSlug(pathname: string): string | null {
  const m = pathname.match(/^\/o\/([^/]+)\/dashboard(?:\/|$)/);
  return m ? m[1]! : null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const password = process.env.SESSION_SECRET;

  const slug = dashboardSlug(pathname);
  // /platform/sign-in must stay reachable, or the guard below redirects it to
  // itself forever.
  const isPlatformSignIn =
    pathname === "/platform/sign-in" || pathname.startsWith("/platform/sign-in/");
  const isPlatform =
    !isPlatformSignIn &&
    (pathname === "/platform" || pathname.startsWith("/platform/"));

  // Without a session secret, we cannot decrypt cookies. Fail closed.
  if (!password || password.length < 32) {
    if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/sign-in", req.url));
    }
    if (isPlatform) {
      return NextResponse.redirect(new URL("/platform/sign-in", req.url));
    }
    if (slug) {
      return NextResponse.redirect(new URL(`/o/${slug}`, req.url));
    }
    return NextResponse.next();
  }

  // Platform console: platform operators only. Checked before the admin branch
  // so a tenant admin session can never stand in for a platform one.
  if (isPlatform) {
    const res = NextResponse.next();
    const session = await getIronSession<PlatformSessionData>(req, res, {
      cookieName: PLATFORM_COOKIE,
      password,
    });
    if (!session.platformAdminId) {
      return NextResponse.redirect(new URL("/platform/sign-in", req.url));
    }
    return res;
  }

  // Admin area: signed-in admins only (sign-in / change-passcode public).
  // The organisation is resolved from the admin's own record downstream, so
  // there is nothing tenant-specific to check here.
  if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname)) {
    const res = NextResponse.next();
    const session = await getIronSession<AdminSessionData>(req, res, {
      cookieName: ADMIN_COOKIE,
      password,
    });
    if (!session.adminId) {
      return NextResponse.redirect(new URL("/admin/sign-in", req.url));
    }
    return res;
  }

  // Public live dashboard: requires a voter session OR an admin session.
  // Whether the holder belongs to this organisation is enforced by the API,
  // which scopes every read to the caller's own tenant.
  if (slug) {
    const res = NextResponse.next();
    const voter = await getIronSession<VoterSessionData>(req, res, {
      cookieName: VOTER_COOKIE,
      password,
    });
    if (voter.voterId) return res;
    const admin = await getIronSession<AdminSessionData>(req, res, {
      cookieName: ADMIN_COOKIE,
      password,
    });
    if (admin.adminId) return res;
    return NextResponse.redirect(new URL(`/o/${slug}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/platform",
    "/platform/:path*",
    "/o/:slug/dashboard",
    "/o/:slug/dashboard/:path*",
  ],
};
