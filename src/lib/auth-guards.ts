import { NextResponse } from "next/server";
import { db } from "./db";
import { getAdminSession, getPlatformSession, getVoterSession } from "./session";

export type Guard<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

const unauthorized = (): { ok: false; response: NextResponse } => ({
  ok: false,
  response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
});

/**
 * The signed-in admin, together with the organisation they belong to.
 *
 * The organisation is read from the database rather than carried in the
 * cookie: a session outlives the row it points at, and a tenant id that can be
 * influenced by anything client-side is exactly the wrong thing to scope
 * queries by. Every caller must filter on the returned `organizationId`.
 */
export async function requireAdmin(): Promise<
  Guard<{ adminId: string; organizationId: string }>
> {
  const session = await getAdminSession();
  if (!session.adminId) return unauthorized();

  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { organizationId: true },
  });
  if (!admin) return unauthorized();

  return {
    ok: true,
    value: { adminId: session.adminId, organizationId: admin.organizationId },
  };
}

/** The signed-in voter, together with the organisation they belong to. */
export async function requireVoter(): Promise<
  Guard<{ voterId: string; organizationId: string }>
> {
  const session = await getVoterSession();
  if (!session.voterId) return unauthorized();

  const voter = await db.voter.findUnique({
    where: { id: session.voterId },
    select: { organizationId: true },
  });
  if (!voter) return unauthorized();

  return {
    ok: true,
    value: { voterId: session.voterId, organizationId: voter.organizationId },
  };
}

/** Either an admin or a voter, plus the organisation the caller belongs to. */
export async function requireAdminOrVoter(): Promise<
  Guard<{ adminId?: string; voterId?: string; organizationId: string }>
> {
  const adminGuard = await requireAdmin();
  if (adminGuard.ok) {
    return {
      ok: true,
      value: {
        adminId: adminGuard.value.adminId,
        organizationId: adminGuard.value.organizationId,
      },
    };
  }

  const voterGuard = await requireVoter();
  if (voterGuard.ok) {
    return {
      ok: true,
      value: {
        voterId: voterGuard.value.voterId,
        organizationId: voterGuard.value.organizationId,
      },
    };
  }

  return unauthorized();
}

/**
 * The platform operator, who sits above all tenants and is the only role that
 * may create organisations. Backed by its own table and its own cookie, so a
 * tenant admin session can never satisfy this guard.
 */
export async function requirePlatformAdmin(): Promise<
  Guard<{ platformAdminId: string }>
> {
  const session = await getPlatformSession();
  if (!session.platformAdminId) return unauthorized();

  const exists = await db.platformAdmin.findUnique({
    where: { id: session.platformAdminId },
    select: { id: true },
  });
  if (!exists) return unauthorized();

  return { ok: true, value: { platformAdminId: session.platformAdminId } };
}
