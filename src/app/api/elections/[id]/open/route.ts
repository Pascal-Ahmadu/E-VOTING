import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { isRevoked, getRevokedIds } from "@/lib/revocation";
import {
  findElectionIdsByStatus,
  getElectionState,
  transitionElection,
} from "@/lib/election-state";

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
    select: {
      id: true,
      name: true,
      positions: {
        select: { id: true, _count: { select: { candidates: true } } },
      },
    },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  const state = await getElectionState(id);
  if (state.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft elections can be opened" },
      { status: 409 },
    );
  }

  // Filter out revoked positions and candidates from the readiness check.
  const [revokedPositionIds, revokedCandidateIds] = await Promise.all([
    getRevokedIds("position"),
    getRevokedIds("candidate"),
  ]);
  const revPos = new Set(revokedPositionIds);
  const revCand = new Set(revokedCandidateIds);
  const livePositions = await db.position.findMany({
    where: { electionId: id, id: { notIn: [...revPos] } },
    select: {
      id: true,
      candidates: { select: { id: true } },
    },
  });
  if (livePositions.length === 0) {
    return NextResponse.json(
      { error: "Add at least one position before opening" },
      { status: 400 },
    );
  }
  if (
    livePositions.some(
      (p) => p.candidates.filter((c) => !revCand.has(c.id)).length === 0,
    )
  ) {
    return NextResponse.json(
      { error: "Every position needs at least one candidate before opening" },
      { status: 400 },
    );
  }

  // Append events: close any currently-open election, then open this one.
  const currentlyOpen = await findElectionIdsByStatus("open");
  for (const otherId of currentlyOpen) {
    if (otherId !== id) {
      await transitionElection({
        electionId: otherId,
        status: "closed",
        changedByAdminId: guard.value.adminId,
      });
    }
  }
  await transitionElection({
    electionId: id,
    status: "open",
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
    action: "election.open",
    targetType: "election",
    targetId: id,
    details: { name: election.name },
    meta: requestMeta(req),
  });

  return NextResponse.json({ ok: true });
}
