import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { buildPage, parsePageParams } from "@/lib/pagination";
import { Title, Description, parseJson } from "@/lib/zod-helpers";
import { getRevokedIds } from "@/lib/revocation";
import { applyPendingSchedules, getElectionStates } from "@/lib/election-state";

const CreateBody = z.object({
  name: Title,
  description: Description.optional().nullable(),
});

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await applyPendingSchedules();

  const url = new URL(req.url);
  const params = parsePageParams(url.searchParams);

  const revokedIds = await getRevokedIds("election");
  const where = revokedIds.length > 0 ? { id: { notIn: revokedIds } } : {};

  const [rows, total] = await db.$transaction([
    db.election.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { positions: true, ballots: true } },
      },
    }),
    db.election.count({ where }),
  ]);

  // Compute current state from event log (latest event wins; falls back to
  // the seed Election.status if no events).
  const states = await getElectionStates(rows.map((r) => r.id));

  return NextResponse.json(
    buildPage(
      rows.map((e) => {
        const state = states.get(e.id);
        return {
          id: e.id,
          name: e.name,
          description: e.description,
          status: state?.status ?? "draft",
          createdAt: e.createdAt.toISOString(),
          openedAt: state?.openedAt?.toISOString() ?? null,
          closedAt: state?.closedAt?.toISOString() ?? null,
          positionCount: e._count.positions,
          ballotCount: e._count.ballots,
        };
      }),
      total,
      params,
    ),
  );
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(req, CreateBody);
  if (!parsed.ok) return parsed.response;
  const { name } = parsed.data;
  const description =
    parsed.data.description && parsed.data.description.length > 0
      ? parsed.data.description
      : null;

  const election = await db.election.create({
    data: { name, description },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  const admin = await db.admin.findUnique({
    where: { id: guard.value.adminId },
    select: { email: true },
  });
  const meta = requestMeta(req);
  await audit({
    adminId: guard.value.adminId,
    adminEmail: admin?.email ?? null,
    action: "election.create",
    targetType: "election",
    targetId: election.id,
    details: { name: election.name },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json(
    {
      election: {
        ...election,
        createdAt: election.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
