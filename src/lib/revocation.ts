import { db } from "./db";

export type RevocationTargetType =
  | "admin"
  | "voter"
  | "election"
  | "position"
  | "candidate";

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
  targetType: RevocationTargetType;
  targetId: string;
  reason?: string;
  revokedByAdminId?: string;
}): Promise<void> {
  await db.revocation.create({
    data: {
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

export async function getRevokedIds(
  targetType: RevocationTargetType,
): Promise<string[]> {
  const rs = await db.revocation.findMany({
    where: { targetType },
    select: { targetId: true },
  });
  return rs.map((r) => r.targetId);
}
