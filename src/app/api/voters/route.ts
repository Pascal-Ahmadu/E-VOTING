import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { buildPage, parsePageParams } from "@/lib/pagination";
import { Email, Name, Password, VoterIdInput, parseJson } from "@/lib/zod-helpers";
import { getRevokedIds, isRevoked, unrevoke } from "@/lib/revocation";
import { decryptVoterFields, encryptVoter } from "@/lib/voter-pii";
import { hashPII } from "@/lib/pii";
import { sendVoterCredentials, sendVoterCredentialsEmail } from "@/lib/messaging";

const CreateBody = z.object({
  name: Name,
  email: Email,
  voterId: VoterIdInput,
  password: Password,
  phone: z.string().trim().optional(),
});

async function restoreVoter(
  id: string,
  fields: { name: string; email: string; voterId: string; password: string; phone?: string },
  organizationId: string,
  adminId: string,
  req: Request,
): Promise<NextResponse> {
  const { name, email, voterId, password, phone } = fields;
  const encrypted = encryptVoter({ name, email, voterId, phone });
  const updated = await db.voter.update({
    where: { id },
    data: { ...encrypted, passwordHash: await hashSecret(password), registeredAt: new Date() },
    select: { id: true, registeredAt: true },
  });
  await unrevoke("voter", id);
  const [whatsappSent, emailSent] = await Promise.all([
    phone
      ? sendVoterCredentials({ phone, password })
      : Promise.resolve(false),
    sendVoterCredentialsEmail({ organizationId, email, name, voterId, password }),
  ]);

  const admin = await db.admin.findUnique({ where: { id: adminId }, select: { email: true } });
  const meta = requestMeta(req);
  await audit({
    organizationId,
    adminId,
    adminEmail: admin?.email ?? null,
    action: "voter.restore",
    targetType: "voter",
    targetId: id,
    details: { email, voterId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(
    { voter: { id, name, email, voterId, registeredAt: updated.registeredAt.toISOString(), password }, whatsappSent, emailSent },
    { status: 200 },
  );
}

const SAFE_FIELDS = {
  id: true,
  name: true,
  email: true,
  voterId: true,
  registeredAt: true,
  _count: { select: { eligibilities: true } },
} as const;

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const params = parsePageParams(url.searchParams);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const revokedIds = await getRevokedIds("voter", guard.value.organizationId);
  // Encrypted columns can't be searched by SQL `contains`. Fetch all live rows,
  // decrypt in memory, then filter + paginate. Voter counts in this app stay
  // small enough that this is fine; revisit if it grows past a few thousand.
  // Tenant filter first: without it this lists every organisation's voters.
  const baseWhere: Prisma.VoterWhereInput = {
    organizationId: guard.value.organizationId,
    ...(revokedIds.length > 0 ? { id: { notIn: revokedIds } } : {}),
  };

  const allRows = await db.voter.findMany({
    where: baseWhere,
    orderBy: { registeredAt: "desc" },
    select: SAFE_FIELDS,
  });

  const decrypted = allRows.map((v) => ({
    ...decryptVoterFields(v),
    _count: v._count,
  }));

  const needle = q.toLowerCase();
  const filtered = needle
    ? decrypted.filter(
        (v) =>
          v.name.toLowerCase().includes(needle) ||
          v.email.toLowerCase().includes(needle) ||
          v.voterId.toLowerCase().includes(needle),
      )
    : decrypted;

  const total = filtered.length;
  const page = filtered.slice(params.skip, params.skip + params.take);

  return NextResponse.json(
    buildPage(
      page.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        voterId: v.voterId,
        registeredAt: v.registeredAt.toISOString(),
        ballotCount: v._count.eligibilities,
      })),
      total,
      params,
    ),
  );
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(req, CreateBody);
  if (!parsed.ok) return parsed.response;
  const { name, email, voterId, password, phone } = parsed.data;

  const emailHash = hashPII(email);
  const voterIdHash = hashPII(voterId);

  // Check for existing voter by email (including revoked ones for potential restore)
  const byEmail = await db.voter.findFirst({
    where: { organizationId: guard.value.organizationId, emailHash },
    select: { id: true, registeredAt: true },
  });
  if (byEmail) {
    if (!(await isRevoked("voter", byEmail.id))) {
      return NextResponse.json(
        { error: "A voter with this email already exists" },
        { status: 409 },
      );
    }
    return await restoreVoter(byEmail.id, { name, email, voterId, password, phone }, guard.value.organizationId, guard.value.adminId, req);
  }

  // Check for existing voter by voter ID
  const byVoterId = await db.voter.findFirst({
    where: { organizationId: guard.value.organizationId, voterIdHash },
    select: { id: true, registeredAt: true },
  });
  if (byVoterId) {
    if (!(await isRevoked("voter", byVoterId.id))) {
      return NextResponse.json(
        { error: "A voter with this voter ID already exists" },
        { status: 409 },
      );
    }
    return await restoreVoter(byVoterId.id, { name, email, voterId, password, phone }, guard.value.organizationId, guard.value.adminId, req);
  }

  const encrypted = encryptVoter({ name, email, voterId, phone });
  let created;
  try {
    created = await db.voter.create({
      data: {
        organizationId: guard.value.organizationId,
        ...encrypted,
        passwordHash: await hashSecret(password),
      },
      select: { id: true, registeredAt: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      if (fields.includes("emailHash")) {
        return NextResponse.json(
          { error: "A voter with this email already exists" },
          { status: 409 },
        );
      }
      if (fields.includes("voterIdHash")) {
        return NextResponse.json(
          { error: "A voter with this voter ID already exists" },
          { status: 409 },
        );
      }
    }
    throw err;
  }

  const [whatsappSent, emailSent] = await Promise.all([
    phone
      ? sendVoterCredentials({ phone, password })
      : Promise.resolve(false),
    sendVoterCredentialsEmail({
      organizationId: guard.value.organizationId,
      email,
      name,
      voterId,
      password,
    }),
  ]);

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    organizationId: guard.value.organizationId,
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "voter.register",
    targetType: "voter",
    targetId: created.id,
    details: { email, voterId },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(
    {
      voter: {
        id: created.id,
        name,
        email,
        voterId,
        registeredAt: created.registeredAt.toISOString(),
        password,
      },
      whatsappSent,
      emailSent,
    },
    { status: 201 },
  );
}
