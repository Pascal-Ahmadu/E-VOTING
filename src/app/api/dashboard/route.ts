import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrVoter } from "@/lib/auth-guards";
import { getRevokedIds } from "@/lib/revocation";
import {
  findElectionIdsByStatus,
  getElectionStates,
} from "@/lib/election-state";

interface CandidateLite {
  id: string;
  name: string;
}

interface PositionLite {
  id: string;
  title: string;
  description: string | null;
  candidates: CandidateLite[];
}

export async function GET() {
  const guard = await requireAdminOrVoter();
  if (!guard.ok) return guard.response;

  const [openIds, closedIds, totalVoters, revokedElectionIds, revokedPositionIds, revokedCandidateIds, revokedVoterIds] =
    await Promise.all([
      findElectionIdsByStatus("open"),
      findElectionIdsByStatus("closed"),
      db.voter.count(),
      getRevokedIds("election"),
      getRevokedIds("position"),
      getRevokedIds("candidate"),
      getRevokedIds("voter"),
    ]);

  const revElec = new Set(revokedElectionIds);
  const liveOpenIds = openIds.filter((id) => !revElec.has(id));
  const liveClosedIds = closedIds.filter((id) => !revElec.has(id));
  const activeTotalVoters = Math.max(0, totalVoters - revokedVoterIds.length);

  const electionSelect = {
    id: true,
    name: true,
    description: true,
    positions: {
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        title: true,
        description: true,
        candidates: {
          orderBy: { createdAt: "asc" as const },
          select: { id: true, name: true },
        },
      },
    },
    _count: { select: { ballots: true } },
  };

  const [openElections, closedElections] = await Promise.all([
    liveOpenIds.length
      ? db.election.findMany({
          where: { id: { in: liveOpenIds } },
          orderBy: { createdAt: "asc" },
          select: electionSelect,
        })
      : Promise.resolve([]),
    liveClosedIds.length
      ? db.election.findMany({
          where: { id: { in: liveClosedIds } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: electionSelect,
        })
      : Promise.resolve([]),
  ]);

  const visibleIds = [
    ...openElections.map((e) => e.id),
    ...closedElections.map((e) => e.id),
  ];
  const states = await getElectionStates(visibleIds);

  const choiceCounts = visibleIds.length
    ? await db.ballotChoice.groupBy({
        by: ["positionId", "candidateId"],
        where: { ballot: { electionId: { in: visibleIds } } },
        _count: { _all: true },
      })
    : [];
  const countByKey = new Map<string, number>();
  for (const row of choiceCounts) {
    countByKey.set(`${row.positionId}:${row.candidateId}`, row._count._all);
  }

  const revPos = new Set(revokedPositionIds);
  const revCand = new Set(revokedCandidateIds);

  const buildTally = (positions: PositionLite[]) =>
    positions
      .filter((p) => !revPos.has(p.id))
      .map((position) => {
        const results = position.candidates
          .filter((c) => !revCand.has(c.id))
          .map((c) => ({
            candidateId: c.id,
            name: c.name,
            votes: countByKey.get(`${position.id}:${c.id}`) ?? 0,
          }))
          .sort((a, b) => b.votes - a.votes);
        return {
          positionId: position.id,
          title: position.title,
          description: position.description,
          results,
          totalVotes: results.reduce((sum, r) => sum + r.votes, 0),
        };
      });

  const shape = (e: (typeof openElections)[number]) => {
    const state = states.get(e.id);
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      status: state?.status ?? "draft",
      openedAt: state?.openedAt?.toISOString() ?? null,
      closedAt: state?.closedAt?.toISOString() ?? null,
      ballotCount: e._count.ballots,
      tally: buildTally(e.positions),
    };
  };

  return NextResponse.json({
    open: openElections.map(shape),
    closed: closedElections.map(shape),
    totalVoters: activeTotalVoters,
  });
}
