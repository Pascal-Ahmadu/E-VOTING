import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const position = await db.position.findUnique({
    where: { id },
    select: {
      title: true,
      electionId: true,
      election: { select: { status: true } },
    },
  });
  if (!position) {
    return NextResponse.json({ error: "Position not found" }, { status: 404 });
  }
  if (position.election.status !== "draft") {
    return NextResponse.json(
      { error: "Election structure is locked" },
      { status: 409 },
    );
  }
  try {
    await db.position.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "This position has ballots referring to it and cannot be removed" },
        { status: 409 },
      );
    }
    throw err;
  }

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "position.remove",
    targetType: "position",
    targetId: id,
    details: { electionId: position.electionId, title: position.title },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
