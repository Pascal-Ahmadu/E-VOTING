import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { Title, Description, parseJson } from "@/lib/zod-helpers";

const Body = z.object({
  title: Title,
  description: Description.optional().nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { title } = parsed.data;
  const description =
    parsed.data.description && parsed.data.description.length > 0
      ? parsed.data.description
      : null;

  const election = await db.election.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }
  if (election.status !== "draft") {
    return NextResponse.json(
      { error: "Election structure is locked" },
      { status: 409 },
    );
  }

  const position = await db.position.create({
    data: { electionId: id, title, description },
    select: { id: true, title: true, description: true },
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "position.add",
    targetType: "position",
    targetId: position.id,
    details: { electionId: id, title: position.title },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ position }, { status: 201 });
}
