import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { getRevokedIds, isRevoked } from "@/lib/revocation";
import { decryptVoterFields } from "@/lib/voter-pii";
import { getElectionState } from "@/lib/election-state";
import { applySchedule } from "@/lib/election-state";
import { getBranding } from "@/lib/branding";

function cell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cols: (string | number | null | undefined)[]): string {
  return cols.map(cell).join(",");
}

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
  await applySchedule(id);

  // ── 1. Election + positions + candidates ───────────────────────────────────
  const election = await db.election.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { ballots: true } },
      positions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          candidates: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  // ── 2. Filter revoked positions / candidates ───────────────────────────────
  const [revokedPositionIds, revokedCandidateIds, state] = await Promise.all([
    getRevokedIds("position"),
    getRevokedIds("candidate"),
    getElectionState(id),
  ]);
  const revPos = new Set(revokedPositionIds);
  const revCand = new Set(revokedCandidateIds);
  const positions = election.positions
    .filter((p) => !revPos.has(p.id))
    .map((p) => ({
      ...p,
      candidates: p.candidates.filter((c) => !revCand.has(c.id)),
    }));

  // ── 3. Vote tallies ────────────────────────────────────────────────────────
  const choiceCounts = await db.ballotChoice.groupBy({
    by: ["positionId", "candidateId"],
    where: { ballot: { electionId: id } },
    _count: { _all: true },
  });
  const countByKey = new Map<string, number>();
  for (const r of choiceCounts) {
    countByKey.set(`${r.positionId}:${r.candidateId}`, r._count._all);
  }

  // ── 4. Voter list + participation ──────────────────────────────────────────
  const revokedVoterIds = await getRevokedIds("voter");
  const revVoters = new Set(revokedVoterIds);

  const [allVoters, participated] = await Promise.all([
    db.voter.findMany({
      orderBy: { registeredAt: "asc" },
      select: { id: true, name: true, email: true, voterId: true, phone: true, registeredAt: true },
    }),
    db.voterEligibility.findMany({
      where: { electionId: id },
      select: { voterId: true, votedAt: true },
    }),
  ]);

  const votedMap = new Map<string, Date>();
  for (const e of participated) votedMap.set(e.voterId, e.votedAt);

  const activeVoters = allVoters
    .filter((v) => !revVoters.has(v.id))
    .map((v) => decryptVoterFields(v));

  // ── 5. Build CSV ───────────────────────────────────────────────────────────
  const lines: string[] = [];

  // Election summary
  lines.push(row("Election", "Status", "Ballots Submitted", "Opened", "Closed"));
  lines.push(row(
    election.name,
    state.status,
    election._count.ballots,
    state.openedAt ? state.openedAt.toLocaleString("en-NG") : "",
    state.closedAt ? state.closedAt.toLocaleString("en-NG") : "",
  ));
  lines.push("");

  // Results
  lines.push(row("Position", "Rank", "Candidate", "Votes", "Vote %", "Winner"));
  for (const pos of positions) {
    const results = pos.candidates
      .map((c) => ({
        name: c.name,
        votes: countByKey.get(`${pos.id}:${c.id}`) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    const totalVotes = results.reduce((s, r) => s + r.votes, 0);

    if (results.length === 0) {
      lines.push(row(pos.title, "", "(no candidates)", "", "", ""));
      continue;
    }
    results.forEach((r, idx) => {
      const pct = totalVotes === 0 ? "0%" : `${Math.round((r.votes / totalVotes) * 100)}%`;
      const winner = state.status === "closed" && idx === 0 && totalVotes > 0 ? "Yes" : "";
      lines.push(row(idx === 0 ? pos.title : "", idx + 1, r.name, r.votes, pct, winner));
    });
  }
  lines.push("");

  // Voter participation
  const { voterIdLabel } = await getBranding();
  lines.push(row(voterIdLabel, "Name", "Email", "Phone", "Registered", "Voted", "Voted At"));
  for (const v of activeVoters) {
    const voted = votedMap.has(v.id);
    const votedAt = voted ? votedMap.get(v.id)!.toLocaleString("en-NG") : "";
    lines.push(row(
      v.voterId,
      v.name,
      v.email,
      v.phone ?? "",
      new Date(v.registeredAt).toLocaleString("en-NG"),
      voted ? "Yes" : "No",
      votedAt,
    ));
  }

  const csv = lines.join("\r\n");
  const filename = `${election.name.replace(/[^a-z0-9]/gi, "_")}_results.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
