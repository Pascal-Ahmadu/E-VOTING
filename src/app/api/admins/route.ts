import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashSecret } from "@/lib/password";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { Email, Name, parseJson } from "@/lib/zod-helpers";
import { getRevokedIds } from "@/lib/revocation";

const Body = z.object({
  name: Name,
  email: Email,
  passcode: z.string().min(4, "Passcode must be at least 4 characters").max(64),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const revokedIds = await getRevokedIds("admin");
  const admins = await db.admin.findMany({
    where: revokedIds.length > 0 ? { id: { notIn: revokedIds } } : undefined,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json({
    admins: admins.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { name, email, passcode } = parsed.data;

  let admin;
  try {
    admin = await db.admin.create({
      data: { name, email, passcodeHash: await hashSecret(passcode) },
      select: { id: true, name: true, email: true, createdAt: true },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An admin with this email already exists" },
        { status: 409 },
      );
    }
    throw err;
  }

  const actor = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: actor?.email ?? null,
    action: "admin.add",
    targetType: "admin",
    targetId: admin.id,
    details: { email: admin.email },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(
    { admin: { ...admin, createdAt: admin.createdAt.toISOString() } },
    { status: 201 },
  );
}
