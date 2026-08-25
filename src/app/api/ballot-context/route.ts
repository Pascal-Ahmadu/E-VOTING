import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVoter } from "@/lib/auth-guards";
import { getRevokedIds, isRevoked } from "@/lib/revocation";
import { applyPendingSchedules, findElectionIdsByStatus } from "@/lib/election-state";
import { decryptVoterFields } from "@/lib/voter-pii";

export async function GET() {
  const guard = await requireVoter();
  if (!guard.ok) return guard.response;
  const voterId = guard.value.voterId;

  const voterRow = await db.voter.findUnique({
    where: { id: voterId },
    select: { id: true, name: true, email: true, voterId: true },
  });
  if (!voterRow) {
    return NextResponse.json({ error: "Voter not found" }, { status: 404 });
  }
  if (await isRevoked("voter", voterRow.id)) {
    return NextResponse.json({ error: "Voter not found" }, { status: 404 });
  }
  const voter = decryptVoterFields(voterRow);

  // Apply any pending scheduled transitions before checking for open elections
  await applyPendingSchedules();

  // Find currently-open elections via the event log
  const openIds = await findElectionIdsByStatus("open");
  const revokedElectionIds = new Set(await getRevokedIds("election"));
  const liveOpenIds = openIds.filter((id) => !revokedElectionIds.has(id));
  if (liveOpenIds.length === 0) {
    return NextResponse.json({ voter, election: null, hasVoted: false });
  }

  const [election, revokedPositionIds, revokedCandidateIds] = await Promise.all(
    [
      db.election.findFirst({
        where: { id: { in: liveOpenIds } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          positions: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              title: true,
              description: true,
              candidates: {
                orderBy: { createdAt: "asc" },
                select: { id: true, name: true, bio: true, photoUrl: true },
              },
            },
          },
        },
      }),
      getRevokedIds("position"),
      getRevokedIds("candidate"),
    ],
  );
  if (!election) {
    return NextResponse.json({ voter, election: null, hasVoted: false });
  }

  const revPos = new Set(revokedPositionIds);
  const revCand = new Set(revokedCandidateIds);
  const filteredElection = {
    ...election,
    positions: election.positions
      .filter((p) => !revPos.has(p.id))
      .map((p) => ({
        ...p,
        candidates: p.candidates.filter((c) => !revCand.has(c.id)),
      })),
  };

  const eligibility = await db.voterEligibility.findUnique({
    where: {
      electionId_voterId: { electionId: election.id, voterId: voter.id },
    },
    select: { id: true },
  });

  return NextResponse.json({
    voter,
    election: filteredElection,
    hasVoted: Boolean(eligibility),
  });
}
