import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { isRevoked, revoke, getRevokedIds } from "@/lib/revocation";
import { applySchedule, getElectionState } from "@/lib/election-state";
import { parseJson } from "@/lib/zod-helpers";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (await isRevoked("election", id)) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }
  // Apply any pending schedule before reading state (lazy scheduler)
  await applySchedule(id);

  const election = await db.election.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      scheduledOpenAt: true,
      scheduledCloseAt: true,
      positions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          candidates: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              bio: true,
              voterRef: true,
              photoUrl: true,
              createdAt: true,
            },
          },
        },
      },
      _count: { select: { ballots: true } },
    },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  // Filter out revoked positions / candidates from the response.
  const [revokedPositionIds, revokedCandidateIds, state] = await Promise.all([
    getRevokedIds("position"),
    getRevokedIds("candidate"),
    getElectionState(id),
  ]);
  const revPosSet = new Set(revokedPositionIds);
  const revCandSet = new Set(revokedCandidateIds);
  const positions = election.positions
    .filter((p) => !revPosSet.has(p.id))
    .map((p) => ({
      ...p,
      candidates: p.candidates.filter((c) => !revCandSet.has(c.id)),
    }));

  const choiceCounts = await db.ballotChoice.groupBy({
    by: ["positionId", "candidateId"],
    where: { ballot: { electionId: id } },
    _count: { _all: true },
  });
  const countByKey = new Map<string, number>();
  for (const row of choiceCounts) {
    countByKey.set(`${row.positionId}:${row.candidateId}`, row._count._all);
  }

  const tally = positions.map((position) => {
    const results = position.candidates
      .map((c) => ({
        candidateId: c.id,
        name: c.name,
        votes: countByKey.get(`${position.id}:${c.id}`) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);
    return {
      positionId: position.id,
      results,
      totalVotes: results.reduce((sum, r) => sum + r.votes, 0),
    };
  });

  return NextResponse.json({
    election: {
      id: election.id,
      name: election.name,
      description: election.description,
      status: state.status,
      createdAt: election.createdAt.toISOString(),
      openedAt: state.openedAt?.toISOString() ?? null,
      closedAt: state.closedAt?.toISOString() ?? null,
      scheduledOpenAt: election.scheduledOpenAt?.toISOString() ?? null,
      scheduledCloseAt: election.scheduledCloseAt?.toISOString() ?? null,
      ballotCount: election._count.ballots,
      positions: positions.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        candidates: p.candidates.map((c) => ({
          id: c.id,
          name: c.name,
          bio: c.bio,
          voterRef: c.voterRef,
          photoUrl: c.photoUrl,
        })),
      })),
      tally,
    },
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const election = await db.election.findUnique({
    where: { id },
    select: { name: true, _count: { select: { ballots: true } } },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }
  if (await isRevoked("election", id)) {
    return NextResponse.json(
      { error: "Election is already removed" },
      { status: 409 },
    );
  }
  if (election._count.ballots > 0) {
    return NextResponse.json(
      { error: "Cannot delete an election that has received ballots" },
      { status: 409 },
    );
  }
  await revoke({
    targetType: "election",
    targetId: id,
    revokedByAdminId: guard.value.adminId,
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "election.delete",
    targetType: "election",
    targetId: id,
    details: { name: election.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}

const ScheduleBody = z.object({
  scheduledOpenAt: z.string().datetime({ offset: true }).nullable().optional(),
  scheduledCloseAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function PATCH(
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

  const parsed = await parseJson(req, ScheduleBody);
  if (!parsed.ok) return parsed.response;
  const { scheduledOpenAt, scheduledCloseAt } = parsed.data;

  if (
    scheduledOpenAt &&
    scheduledCloseAt &&
    new Date(scheduledOpenAt) >= new Date(scheduledCloseAt)
  ) {
    return NextResponse.json(
      { error: "Close time must be after open time" },
      { status: 400 },
    );
  }

  await db.election.update({
    where: { id },
    data: {
      ...(scheduledOpenAt !== undefined && {
        scheduledOpenAt: scheduledOpenAt ? new Date(scheduledOpenAt) : null,
      }),
      ...(scheduledCloseAt !== undefined && {
        scheduledCloseAt: scheduledCloseAt ? new Date(scheduledCloseAt) : null,
      }),
    },
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    actorType: "admin",
    actorId: guard.value.adminId,
    actorLabel: admin?.email ?? null,
    action: "election.schedule",
    targetType: "election",
    targetId: id,
    details: { scheduledOpenAt: scheduledOpenAt ?? null, scheduledCloseAt: scheduledCloseAt ?? null },
    meta,
  });

  return NextResponse.json({ ok: true });
}
