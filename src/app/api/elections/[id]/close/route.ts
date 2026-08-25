import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { isRevoked } from "@/lib/revocation";
import { getElectionState, transitionElection } from "@/lib/election-state";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (await isRevoked("election", id)) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }
  const election = await db.election.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }
  const state = await getElectionState(id);
  if (state.status !== "open") {
    return NextResponse.json(
      { error: "Only open elections can be closed" },
      { status: 409 },
    );
  }
  await transitionElection({
    electionId: id,
    status: "closed",
    changedByAdminId: guard.value.adminId,
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  await audit({
    actorType: "admin",
    actorId: guard.value.adminId,
    actorLabel: admin?.email ?? null,
    action: "election.close",
    targetType: "election",
    targetId: id,
    details: { name: election.name },
    meta: requestMeta(req),
  });

  return NextResponse.json({ ok: true });
}
