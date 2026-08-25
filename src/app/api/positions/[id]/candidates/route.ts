import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { Name, Description, parseJson } from "@/lib/zod-helpers";

const Body = z.object({
  name: Name,
  bio: Description.optional().nullable(),
  voterRef: z.string().min(1).optional().nullable(),
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
  const { name } = parsed.data;
  const bio =
    parsed.data.bio && parsed.data.bio.length > 0 ? parsed.data.bio : null;
  const voterRef = parsed.data.voterRef ?? null;

  const position = await db.position.findUnique({
    where: { id },
    select: { electionId: true, election: { select: { status: true } } },
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
  if (voterRef) {
    const voterExists = await db.voter.findUnique({
      where: { id: voterRef },
      select: { id: true },
    });
    if (!voterExists) {
      return NextResponse.json(
        { error: "Selected voter could not be found" },
        { status: 400 },
      );
    }
  }

  const candidate = await db.candidate.create({
    data: { positionId: id, name, bio, voterRef },
    select: { id: true, name: true, bio: true, voterRef: true },
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "candidate.add",
    targetType: "candidate",
    targetId: candidate.id,
    details: { positionId: id, name: candidate.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ candidate }, { status: 201 });
}
