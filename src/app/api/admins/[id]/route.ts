import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { getRevokedIds, isRevoked, revoke } from "@/lib/revocation";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const currentAdminId = guard.value.adminId;

  const { id } = await ctx.params;
  if (id === currentAdminId) {
    return NextResponse.json(
      { error: "You cannot remove the admin you are signed in as" },
      { status: 409 },
    );
  }

  const total = await db.admin.count();
  const revokedAdminIds = await getRevokedIds("admin");
  const active = total - revokedAdminIds.length;
  if (active <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last admin" },
      { status: 409 },
    );
  }

  const target = await db.admin.findUnique({
    where: { id },
    select: { email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }
  if (await isRevoked("admin", id)) {
    return NextResponse.json(
      { error: "Admin is already removed" },
      { status: 409 },
    );
  }
  // INSERT revocation row (no DELETE) — physical record persists for audit.
  await revoke({
    targetType: "admin",
    targetId: id,
    revokedByAdminId: currentAdminId,
  });

  const actor = await db.admin.findUnique({
    where: { id: currentAdminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: currentAdminId,
    adminEmail: actor?.email ?? null,
    action: "admin.remove",
    targetType: "admin",
    targetId: id,
    details: { email: target?.email ?? null },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
