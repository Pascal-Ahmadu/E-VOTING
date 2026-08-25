import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const session = await getAdminSession();
  const adminId = session.adminId;
  if (adminId) {
    const admin = await db.admin.findUnique({
      where: { id: adminId },
      select: { email: true },
    });
    await audit({
      actorType: "admin",
      actorId: adminId,
      actorLabel: admin?.email ?? null,
      action: "admin.signout",
      meta: requestMeta(req),
    });
  }
  session.destroy();
  return NextResponse.json({ ok: true });
}
