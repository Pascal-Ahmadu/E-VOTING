import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rotateVoterPassword } from "@/lib/credentials";
import { isRevoked } from "@/lib/revocation";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { decryptVoterFields } from "@/lib/voter-pii";
import { sendVoterCredentials, sendVoterCredentialsEmail } from "@/lib/messaging";

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
      organizationId: true,
      name: true,
      email: true,
      voterId: true,
      phone: true,
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

  // Deliver the new password the same way registration does, so the admin
  // sees whether the voter actually received it rather than a blanket failure.
  const [whatsappSent, emailSent] = await Promise.all([
    voter.phone
      ? sendVoterCredentials({ phone: voter.phone, password })
      : Promise.resolve(false),
    sendVoterCredentialsEmail({
      organizationId: voter.organizationId,
      email: voter.email,
      name: voter.name,
      voterId: voter.voterId,
      password,
    }),
  ]);

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
      id: voter.id,
      name: voter.name,
      email: voter.email,
      voterId: voter.voterId,
      registeredAt: voter.registeredAt.toISOString(),
      password,
    },
    whatsappSent,
    emailSent,
    phoneUsed: voter.phone ?? undefined,
  });
}
