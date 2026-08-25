import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

interface AdminSessionData {
  adminId?: string;
}

interface VoterSessionData {
  voterId?: string;
}

const ADMIN_COOKIE = "evoting_admin_session";
const VOTER_COOKIE = "evoting_voter_session";
const PUBLIC_ADMIN_PATHS = ["/admin/sign-in", "/admin/change-password"];

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const password = process.env.SESSION_SECRET;

  // Without a session secret, we cannot decrypt cookies. Fail closed.
  if (!password || password.length < 32) {
    if (pathname.startsWith("/admin") && !isPublicAdminPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/sign-in", req.url));
    }
    if (isDashboardPath(pathname)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Admin area: signed-in admins only (sign-in / change-passcode public)
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
  if (isDashboardPath(pathname)) {
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
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*"],
};
