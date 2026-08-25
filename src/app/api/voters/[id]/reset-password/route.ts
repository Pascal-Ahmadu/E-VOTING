import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rotateVoterPassword } from "@/lib/credentials";
import { isRevoked } from "@/lib/revocation";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { decryptVoterFields } from "@/lib/voter-pii";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 8;

function generatePassword(): string {
  let password = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    password += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return password;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const voterRow = await db.voter.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      voterId: true,
      registeredAt: true,
    },
  });
  if (!voterRow) {
    return NextResponse.json({ error: "Voter not found" }, { status: 404 });
  }
  if (await isRevoked("voter", voterRow.id)) {
    return NextResponse.json(
      { error: "Voter has been removed" },
      { status: 410 },
    );
  }
  const voter = decryptVoterFields(voterRow);
  const password = generatePassword();
  await rotateVoterPassword(voter.id, password);

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "voter.reset_password",
    targetType: "voter",
    targetId: voter.id,
    details: { voterId: voter.voterId, email: voter.email },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    voter: {
      ...voter,
      registeredAt: voter.registeredAt.toISOString(),
      password,
    },
  });
}
