import { db } from "./db";

export type ElectionStatus = "draft" | "open" | "closed";

export interface ElectionState {
  status: ElectionStatus;
  openedAt: Date | null;
  closedAt: Date | null;
}

/**
 * Compute current state for a single election by walking its status event log
 * (latest event wins). If no events exist, fall back to the initial values on
 * the Election row.
 */
export async function getElectionState(
  electionId: string,
): Promise<ElectionState> {
  const events = await db.electionStatusEvent.findMany({
    where: { electionId },
    orderBy: { createdAt: "asc" },
    select: { status: true, createdAt: true },
  });

  if (events.length === 0) {
    const election = await db.election.findUnique({
      where: { id: electionId },
      select: { status: true, openedAt: true, closedAt: true },
    });
    return {
      status: (election?.status as ElectionStatus) ?? "draft",
      openedAt: election?.openedAt ?? null,
      closedAt: election?.closedAt ?? null,
    };
  }

  let status: ElectionStatus = "draft";
  let openedAt: Date | null = null;
  let closedAt: Date | null = null;
  for (const event of events) {
    status = event.status as ElectionStatus;
    if (status === "open" && !openedAt) openedAt = event.createdAt;
    if (status === "closed") closedAt = event.createdAt;
  }
  return { status, openedAt, closedAt };
}

/**
 * Same as getElectionState but for many elections in two queries — useful when
 * listing.
 */
export async function getElectionStates(
  electionIds: string[],
): Promise<Map<string, ElectionState>> {
  if (electionIds.length === 0) return new Map();
  const events = await db.electionStatusEvent.findMany({
    where: { electionId: { in: electionIds } },
    orderBy: { createdAt: "asc" },
    select: { electionId: true, status: true, createdAt: true },
  });
  const elections = await db.election.findMany({
    where: { id: { in: electionIds } },
    select: { id: true, status: true, openedAt: true, closedAt: true },
  });
  const baseline = new Map(elections.map((e) => [e.id, e]));

  // Walk events per election to compute final state
  const states = new Map<string, ElectionState>();
  for (const id of electionIds) {
    const initial = baseline.get(id);
    states.set(id, {
      status: (initial?.status as ElectionStatus) ?? "draft",
      openedAt: initial?.openedAt ?? null,
      closedAt: initial?.closedAt ?? null,
    });
  }
  for (const event of events) {
    const cur = states.get(event.electionId);
    if (!cur) continue;
    cur.status = event.status as ElectionStatus;
    if (cur.status === "open" && !cur.openedAt) cur.openedAt = event.createdAt;
    if (cur.status === "closed") cur.closedAt = event.createdAt;
  }
  return states;
}

export async function transitionElection(input: {
  electionId: string;
  status: ElectionStatus;
  changedByAdminId: string | null;
}): Promise<void> {
  await db.electionStatusEvent.create({
    data: {
      electionId: input.electionId,
      status: input.status,
      changedByAdminId: input.changedByAdminId,
    },
  });
}

/**
 * Lazily applies scheduled open/close transitions for a single election.
 * Called on every GET of that election so no background job is needed.
 */
export async function applySchedule(electionId: string): Promise<void> {
  const election = await db.election.findUnique({
    where: { id: electionId },
    select: { scheduledOpenAt: true, scheduledCloseAt: true },
  });
  if (!election) return;
  if (!election.scheduledOpenAt && !election.scheduledCloseAt) return;

  const state = await getElectionState(electionId);
  const now = new Date();

  if (
    state.status === "draft" &&
    election.scheduledOpenAt &&
    election.scheduledOpenAt <= now
  ) {
    // Verify election is ready (at least one position with at least one candidate)
    const positions = await db.position.findMany({
      where: { electionId },
      select: { _count: { select: { candidates: true } } },
    });
    const ready =
      positions.length > 0 && positions.every((p) => p._count.candidates > 0);
    if (ready) {
      await transitionElection({ electionId, status: "open", changedByAdminId: null });
      // Refresh state for close check below
      state.status = "open";
    }
  }

  if (
    state.status === "open" &&
    election.scheduledCloseAt &&
    election.scheduledCloseAt <= now
  ) {
    await transitionElection({ electionId, status: "closed", changedByAdminId: null });
  }
}

/**
 * Applies pending scheduled transitions across all elections.
 * Called from list/ballot-context routes to ensure schedules fire even when
 * the admin isn't actively viewing a specific election.
 */
export async function applyPendingSchedules(): Promise<void> {
  const now = new Date();
  const candidates = await db.election.findMany({
    where: {
      OR: [
        { scheduledOpenAt: { lte: now } },
        { scheduledCloseAt: { lte: now } },
      ],
    },
    select: { id: true },
  });
  for (const { id } of candidates) {
    await applySchedule(id);
  }
}

/**
 * Returns the IDs of all elections currently in `status`. Walks the latest
 * event per election; falls back to Election.status if no events.
 */
export async function findElectionIdsByStatus(
  status: ElectionStatus,
): Promise<string[]> {
  // Latest event per election
  const events = await db.electionStatusEvent.findMany({
    orderBy: { createdAt: "desc" },
    distinct: ["electionId"],
    select: { electionId: true, status: true },
  });
  const eventMap = new Map(events.map((e) => [e.electionId, e.status]));

  // Elections that have NO events — must check their seed status
  const noEventElections = await db.election.findMany({
    where: { id: { notIn: [...eventMap.keys()] } },
    select: { id: true, status: true },
  });

  const ids: string[] = [];
  for (const [electionId, eventStatus] of eventMap) {
    if (eventStatus === status) ids.push(electionId);
  }
  for (const e of noEventElections) {
    if (e.status === status) ids.push(e.id);
  }
  return ids;
}
