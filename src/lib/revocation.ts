import { db } from "./db";

export type RevocationTargetType =
  | "admin"
  | "voter"
  | "election"
  | "position"
  | "candidate";

/**
 * Whether a single target is revoked.
 *
 * Not scoped by organisation: `targetId` is a globally unique cuid, and every
 * caller has already loaded the target through a tenant-filtered query, so the
 * id could not belong to another organisation by the time we get here.
 */
export async function isRevoked(
  targetType: RevocationTargetType,
  targetId: string,
): Promise<boolean> {
  const r = await db.revocation.findUnique({
    where: { targetType_targetId: { targetType, targetId } },
    select: { id: true },
  });
  return Boolean(r);
}

export async function revoke(input: {
  organizationId: string;
  targetType: RevocationTargetType;
  targetId: string;
  reason?: string;
  revokedByAdminId?: string;
}): Promise<void> {
  await db.revocation.create({
    data: {
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason ?? null,
      revokedByAdminId: input.revokedByAdminId ?? null,
    },
  });
}

export async function unrevoke(
  targetType: RevocationTargetType,
  targetId: string,
): Promise<void> {
  await db.revocation.deleteMany({ where: { targetType, targetId } });
}

/**
 * Revoked ids of one type within one organisation. Scoped deliberately: an
 * unscoped list would hand one tenant a set of another tenant's row ids.
 */
export async function getRevokedIds(
  targetType: RevocationTargetType,
  organizationId: string,
): Promise<string[]> {
  const rs = await db.revocation.findMany({
    where: { targetType, organizationId },
    select: { targetId: true },
  });
  return rs.map((r) => r.targetId);
}
