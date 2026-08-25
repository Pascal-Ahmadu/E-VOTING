import { db } from "./db";
import { hashSecret } from "./password";

/**
 * Returns the currently-active passcode hash for an admin. If credentials have
 * been rotated, this returns the most recent rotation; otherwise it falls back
 * to the initial seed credential on the Admin row.
 */
export async function getActiveAdminPasscodeHash(
  adminId: string,
): Promise<string | null> {
  const latest = await db.adminCredential.findFirst({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    select: { passcodeHash: true },
  });
  if (latest) return latest.passcodeHash;
  const admin = await db.admin.findUnique({
    where: { id: adminId },
    select: { passcodeHash: true },
  });
  return admin?.passcodeHash ?? null;
}

/** Append a new admin credential row. Never UPDATEs the Admin record. */
export async function rotateAdminPasscode(
  adminId: string,
  newPasscode: string,
): Promise<void> {
  await db.adminCredential.create({
    data: { adminId, passcodeHash: await hashSecret(newPasscode) },
  });
}

/** Latest active password hash for a voter (rotation-aware). */
export async function getActiveVoterPasswordHash(
  voterId: string,
): Promise<string | null> {
  const latest = await db.voterCredential.findFirst({
    where: { voterId },
    orderBy: { createdAt: "desc" },
    select: { passwordHash: true },
  });
  if (latest) return latest.passwordHash;
  const voter = await db.voter.findUnique({
    where: { id: voterId },
    select: { passwordHash: true },
  });
  return voter?.passwordHash ?? null;
}

/** Append a new voter credential row. Never UPDATEs the Voter record. */
export async function rotateVoterPassword(
  voterId: string,
  newPassword: string,
): Promise<void> {
  await db.voterCredential.create({
    data: { voterId, passwordHash: await hashSecret(newPassword) },
  });
}
