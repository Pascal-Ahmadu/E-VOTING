import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireVoter } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { tryDecrypt } from "@/lib/pii";
import { getElectionState } from "@/lib/election-state";

const BodySchema = z.object({
  electionId: z.string().min(1),
  choices: z
    .array(
      z.object({
        positionId: z.string().min(1),
        candidateId: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireVoter();
  if (!guard.ok) return guard.response;
  const voterId = guard.value.voterId;

  const parsed = await parseJson(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const { electionId, choices } = parsed.data;

  const election = await db.election.findUnique({
    where: { id: electionId },
    select: {
      positions: {
        select: { id: true, candidates: { select: { id: true } } },
      },
    },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  // Use the event-log state — Election.status column is never mutated after
  // creation, so checking it directly would always read "draft".
  const state = await getElectionState(electionId);
  if (state.status !== "open") {
    return NextResponse.json(
      { error: "This election is not open for voting" },
      { status: 409 },
    );
  }

  const allowedByPosition = new Map<string, Set<string>>();
  for (const position of election.positions) {
    allowedByPosition.set(
      position.id,
      new Set(position.candidates.map((c) => c.id)),
    );
  }

  if (choices.length !== election.positions.length) {
    return NextResponse.json(
      { error: "A selection is required for every position" },
      { status: 400 },
    );
  }

  const seen = new Set<string>();
  for (const choice of choices) {
    const allowed = allowedByPosition.get(choice.positionId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Ballot contains an unknown position" },
        { status: 400 },
      );
    }
    if (seen.has(choice.positionId)) {
      return NextResponse.json(
        { error: "Ballot contains duplicate selections" },
        { status: 400 },
      );
    }
    seen.add(choice.positionId);
    if (!allowed.has(choice.candidateId)) {
      return NextResponse.json(
        { error: "Selected candidate is not valid for this position" },
        { status: 400 },
      );
    }
  }

  // Single transaction:
  //   1. Mark voter eligible-once: row in voter_eligibility blocks repeat.
  //   2. Insert anonymous Ballot with random token.
  //   3. Insert BallotChoice rows for each position.
  // The eligibility row carries voterId. The ballot row does NOT — they
  // are inserted in the same transaction but never joined back.
  const ballotToken = crypto.randomBytes(24).toString("base64url");
  try {
    await db.$transaction(async (tx) => {
      await tx.voterEligibility.create({
        data: { electionId, voterId },
      });
      const ballot = await tx.ballot.create({
        data: { electionId, ballotToken },
        select: { id: true },
      });
      await tx.ballotChoice.createMany({
        data: choices.map((c) => ({
          ballotId: ballot.id,
          positionId: c.positionId,
          candidateId: c.candidateId,
        })),
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This voter has already submitted a ballot" },
        { status: 409 },
      );
    }
    throw err;
  }

  // Audit only the FACT of submission (voter + election + receipt token).
  // We deliberately do NOT log the choices — that would re-introduce the
  // voter→ballot link the schema is designed to break.
  const voter = await db.voter.findUnique({
    where: { id: voterId },
    select: { voterId: true },
  });
  await audit({
    actorType: "voter",
    actorId: voterId,
    actorLabel: voter ? tryDecrypt(voter.voterId) : null,
    action: "ballot.submit",
    targetType: "election",
    targetId: electionId,
    details: { receipt: ballotToken },
    meta: requestMeta(req),
  });

  return NextResponse.json({ ok: true, receipt: ballotToken }, { status: 201 });
}
