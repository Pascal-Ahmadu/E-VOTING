"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Breadcrumb from "@/components/common/Breadcrumb";
import StatusBadge from "@/components/voting/StatusBadge";
import ResultsList from "@/components/voting/ResultsList";
import { ElectionDetailSkeleton } from "@/components/voting/skeletons";
import { apiCall } from "@/lib/api-client";
import { PlusIcon, TrashBinIcon } from "@/icons";

type ElectionStatus = "draft" | "open" | "closed";

interface CandidateView {
  id: string;
  name: string;
  bio: string | null;
  voterRef: string | null;
  photoUrl: string | null;
}

interface PositionView {
  id: string;
  title: string;
  description: string | null;
  candidates: CandidateView[];
}

interface PositionTallyView {
  positionId: string;
  results: { candidateId: string; name: string; votes: number }[];
  totalVotes: number;
}

interface ElectionDetail {
  id: string;
  name: string;
  description: string | null;
  status: ElectionStatus;
  openedAt: string | null;
  closedAt: string | null;
  scheduledOpenAt: string | null;
  scheduledCloseAt: string | null;
  ballotCount: number;
  positions: PositionView[];
  tally: PositionTallyView[];
}

interface VoterLite {
  id: string;
  name: string;
  email: string;
  voterId: string;
}

interface PositionForm {
  title: string;
  description: string;
}

interface CandidateForm {
  name: string;
  bio: string;
  voterRef: string | null;
}

const EMPTY_POSITION_FORM: PositionForm = { title: "", description: "" };
const EMPTY_CANDIDATE_FORM: CandidateForm = { name: "", bio: "", voterRef: null };

type ConfirmTarget =
  | { kind: "election"; id: string; label: string }
  | { kind: "position"; id: string; label: string }
  | { kind: "candidate"; id: string; label: string };

export default function ElectionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const electionId = params.id;

  const [election, setElection] = useState<ElectionDetail | null | undefined>(undefined);
  const [voters, setVoters] = useState<VoterLite[]>([]);

  const [positionForm, setPositionForm] = useState<PositionForm>(EMPTY_POSITION_FORM);
  const [positionError, setPositionError] = useState<string | null>(null);

  const [candidateDrafts, setCandidateDrafts] = useState<Record<string, CandidateForm>>({});
  const [candidateErrors, setCandidateErrors] = useState<Record<string, string>>({});

  const [statusError, setStatusError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);

  const [scheduleOpenAt, setScheduleOpenAt] = useState("");
  const [scheduleCloseAt, setScheduleCloseAt] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(async () => {
    const result = await apiCall<{ election: ElectionDetail }>(
      `/api/elections/${electionId}`,
    );
    if (result.ok) {
      setElection(result.data.election);
    } else if (result.status === 404) {
      setElection(null);
    }
  }, [electionId]);

  const refreshVoters = useCallback(async () => {
    const result = await apiCall<{
      data: VoterLite[];
      total: number;
    }>("/api/voters?pageSize=100");
    if (result.ok) setVoters(result.data.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    refreshVoters();
  }, [refresh, refreshVoters]);

  // Sync schedule inputs when election data loads
  useEffect(() => {
    if (!election) return;
    setScheduleOpenAt(
      election.scheduledOpenAt
        ? toDatetimeLocal(election.scheduledOpenAt)
        : "",
    );
    setScheduleCloseAt(
      election.scheduledCloseAt
        ? toDatetimeLocal(election.scheduledCloseAt)
        : "",
    );
  }, [election]);

  // Tick every second for countdown display
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isDraft = election?.status === "draft";
  const isOpen = election?.status === "open";
  const isClosed = election?.status === "closed";

  const canOpen = useMemo(() => {
    if (!election || !isDraft) return false;
    if (election.positions.length === 0) return false;
    return election.positions.every((p) => p.candidates.length > 0);
  }, [election, isDraft]);

  const linkedVoterIdsInElection = useMemo(() => {
    if (!election) return new Set<string>();
    const ids = new Set<string>();
    for (const position of election.positions) {
      for (const candidate of position.candidates) {
        if (candidate.voterRef) ids.add(candidate.voterRef);
      }
    }
    return ids;
  }, [election]);

  const votersById = useMemo(() => {
    const map = new Map<string, VoterLite>();
    for (const voter of voters) map.set(voter.id, voter);
    return map;
  }, [voters]);

  const updateCandidateDraft = (positionId: string, patch: Partial<CandidateForm>) => {
    setCandidateDrafts((p) => ({
      ...p,
      [positionId]: { ...(p[positionId] ?? EMPTY_CANDIDATE_FORM), ...patch },
    }));
    if (candidateErrors[positionId]) {
      setCandidateErrors((p) => {
        const next = { ...p };
        delete next[positionId];
        return next;
      });
    }
  };

  const handleAddPosition = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!election || !isDraft) return;
    const title = positionForm.title.trim();
    if (!title) {
      setPositionError("Title is required");
      return;
    }
    const result = await apiCall<{ position: { id: string } }>(
      `/api/elections/${electionId}/positions`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          description: positionForm.description.trim() || undefined,
        }),
      },
    );
    if (!result.ok) {
      setPositionError(result.error);
      return;
    }
    setPositionForm(EMPTY_POSITION_FORM);
    setPositionError(null);
    refresh();
  };

  const handleAddCandidate = async (positionId: string) => {
    if (!isDraft) return;
    const draft = candidateDrafts[positionId] ?? EMPTY_CANDIDATE_FORM;
    const name = draft.name.trim();
    if (!name) {
      setCandidateErrors((p) => ({ ...p, [positionId]: "Candidate name is required" }));
      return;
    }
    const result = await apiCall<{ candidate: { id: string } }>(
      `/api/positions/${positionId}/candidates`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          bio: draft.bio.trim() || undefined,
          voterRef: draft.voterRef ?? undefined,
        }),
      },
    );
    if (!result.ok) {
      setCandidateErrors((p) => ({ ...p, [positionId]: result.error }));
      return;
    }
    setCandidateDrafts((p) => ({ ...p, [positionId]: EMPTY_CANDIDATE_FORM }));
    setCandidateErrors((p) => {
      const next = { ...p };
      delete next[positionId];
      return next;
    });
    refresh();
  };

  const handleUploadPhoto = async (candidateId: string, file: File) => {
    const body = new FormData();
    body.append("photo", file);
    const result = await apiCall<{ photoUrl: string }>(
      `/api/candidates/${candidateId}/photo`,
      { method: "POST", body },
    );
    if (result.ok) refresh();
    else setStatusError(result.error);
  };

  const handleRemovePhoto = async (candidateId: string) => {
    const result = await apiCall<{ ok: true }>(
      `/api/candidates/${candidateId}/photo`,
      { method: "DELETE" },
    );
    if (result.ok) refresh();
    else setStatusError(result.error);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    let result;
    if (confirm.kind === "election") {
      result = await apiCall<{ ok: true }>(`/api/elections/${confirm.id}`, {
        method: "DELETE",
      });
    } else if (confirm.kind === "position") {
      result = await apiCall<{ ok: true }>(`/api/positions/${confirm.id}`, {
        method: "DELETE",
      });
    } else {
      result = await apiCall<{ ok: true }>(`/api/candidates/${confirm.id}`, {
        method: "DELETE",
      });
    }
    if (!result.ok) {
      setStatusError(result.error);
      setConfirm(null);
      return;
    }
    setConfirm(null);
    if (confirm.kind === "election") {
      router.replace("/admin/elections");
      return;
    }
    refresh();
  };

  const handleOpenElection = async () => {
    const result = await apiCall<{ ok: true }>(
      `/api/elections/${electionId}/open`,
      { method: "POST" },
    );
    if (!result.ok) {
      setStatusError(result.error);
      return;
    }
    setStatusError(null);
    refresh();
  };

  const handleCloseElection = async () => {
    const result = await apiCall<{ ok: true }>(
      `/api/elections/${electionId}/close`,
      { method: "POST" },
    );
    if (!result.ok) {
      setStatusError(result.error);
      return;
    }
    setStatusError(null);
    refresh();
  };

  const handleSaveSchedule = async () => {
    if (scheduleOpenAt && scheduleCloseAt) {
      if (new Date(scheduleOpenAt) >= new Date(scheduleCloseAt)) {
        setScheduleError("Close time must be after open time.");
        return;
      }
    }
    setScheduleSaving(true);
    setScheduleError(null);
    const result = await apiCall<{ ok: true }>(
      `/api/elections/${electionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          scheduledOpenAt: scheduleOpenAt ? new Date(scheduleOpenAt).toISOString() : null,
          scheduledCloseAt: scheduleCloseAt ? new Date(scheduleCloseAt).toISOString() : null,
        }),
      },
    );
    setScheduleSaving(false);
    if (!result.ok) {
      setScheduleError(result.error);
      return;
    }
    refresh();
  };

  const handleClearSchedule = async () => {
    setScheduleSaving(true);
    setScheduleError(null);
    await apiCall<{ ok: true }>(`/api/elections/${electionId}`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledOpenAt: null, scheduledCloseAt: null }),
    });
    setScheduleSaving(false);
    setScheduleOpenAt("");
    setScheduleCloseAt("");
    refresh();
  };

  const hasSchedule =
    election &&
    (election.scheduledOpenAt || election.scheduledCloseAt);

  if (election === undefined) {
    return <ElectionDetailSkeleton />;
  }
  if (election === null) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Election not found
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          This election may have been removed.
        </p>
        <Link
          href="/admin/elections"
          className="mt-4 inline-block text-sm text-brand-500 hover:text-brand-600"
        >
          Back to elections
        </Link>
      </div>
    );
  }

  const resultsListInput = election.tally.map((t) => ({
    positionId: t.positionId,
    title: election.positions.find((p) => p.id === t.positionId)?.title ?? "",
    results: t.results,
    totalVotes: t.totalVotes,
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Elections", href: "/admin/elections" },
          { label: election.name },
        ]}
      />

      <header id="tour-election-header" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {election.name}
              </h1>
              <StatusBadge status={election.status} />
            </div>
            {election.description && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {election.description}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              {election.positions.length} position
              {election.positions.length === 1 ? "" : "s"} · {election.ballotCount}{" "}
              ballot{election.ballotCount === 1 ? "" : "s"} submitted
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <Button
                onClick={handleOpenElection}
                disabled={!canOpen}
                variant="primary"
                size="sm"
              >
                Open for voting
              </Button>
            )}
            {isOpen && (
              <Button onClick={handleCloseElection} variant="primary" size="sm">
                Close election
              </Button>
            )}
            {isDraft && election.ballotCount === 0 && (
              <Button
                variant="ghost"
                size="sm"
                startIcon={<TrashBinIcon />}
                onClick={() =>
                  setConfirm({
                    kind: "election",
                    id: election.id,
                    label: election.name,
                  })
                }
              >
                Delete
              </Button>
            )}
          </div>
        </div>
        {statusError && (
          <p role="alert" className="mt-3 text-sm text-error-500">
            {statusError}
          </p>
        )}
        {isDraft && !canOpen && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Add at least one position with at least one candidate to open this election.
          </p>
        )}
      </header>

      {(isDraft || isOpen) && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schedule
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isDraft
              ? "Optionally set a time to auto-open and auto-close this election. Times are in your local timezone."
              : "Update the scheduled close time. The election is already open."}
          </p>

          {hasSchedule && (
            <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-800/40 dark:bg-brand-900/10">
              {election.scheduledOpenAt && isDraft && (
                <ScheduleCountdown
                  label="Opens in"
                  target={election.scheduledOpenAt}
                  now={now}
                />
              )}
              {election.scheduledCloseAt && (
                <ScheduleCountdown
                  label={isOpen ? "Closes in" : "Scheduled close"}
                  target={election.scheduledCloseAt}
                  now={now}
                />
              )}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {isDraft && (
              <div>
                <label
                  htmlFor="sched-open"
                  className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Open at
                </label>
                <input
                  id="sched-open"
                  type="datetime-local"
                  value={scheduleOpenAt}
                  onChange={(e) => {
                    setScheduleOpenAt(e.target.value);
                    if (scheduleError) setScheduleError(null);
                  }}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="sched-close"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Close at
              </label>
              <input
                id="sched-close"
                type="datetime-local"
                value={scheduleCloseAt}
                onChange={(e) => {
                  setScheduleCloseAt(e.target.value);
                  if (scheduleError) setScheduleError(null);
                }}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
          </div>

          {scheduleError && (
            <p role="alert" className="mt-2 text-sm text-error-500">
              {scheduleError}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {hasSchedule && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSchedule}
                disabled={scheduleSaving}
              >
                Clear schedule
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveSchedule}
              loading={scheduleSaving}
              disabled={!scheduleOpenAt && !scheduleCloseAt && !hasSchedule}
            >
              {scheduleSaving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </section>
      )}

      {isDraft && (
        <section id="tour-add-position-section" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add a position
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For example: President, Treasurer, Class Representative.
          </p>
          <form
            onSubmit={handleAddPosition}
            noValidate
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="position-title">Title</Label>
              <Input
                id="position-title"
                value={positionForm.title}
                onChange={(e) => {
                  setPositionForm((p) => ({ ...p, title: e.target.value }));
                  if (positionError) setPositionError(null);
                }}
                placeholder="e.g. President"
                maxLength={80}
                required
                error={Boolean(positionError)}
              />
            </div>
            <div>
              <Label htmlFor="position-description">Description (optional)</Label>
              <Input
                id="position-description"
                value={positionForm.description}
                onChange={(e) =>
                  setPositionForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Shown to voters on the ballot"
                maxLength={280}
              />
            </div>
            <Button type="submit" startIcon={<PlusIcon />}>
              Add
            </Button>
          </form>
          {positionError && (
            <p role="alert" className="mt-2 text-sm text-error-500">
              {positionError}
            </p>
          )}
        </section>
      )}

      <section id="tour-positions-section" className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {isDraft ? "Positions & candidates" : "Ballot structure"}
        </h2>

        {election.positions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No positions yet. Add one above to get started.
          </div>
        ) : (
          election.positions.map((position) => {
            const draft = candidateDrafts[position.id] ?? EMPTY_CANDIDATE_FORM;
            const error = candidateErrors[position.id];
            return (
              <article
                key={position.id}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {position.title}
                    </h3>
                    {position.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {position.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {position.candidates.length} candidate
                      {position.candidates.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      ariaLabel={`Remove position ${position.title}`}
                      startIcon={<TrashBinIcon />}
                      onClick={() =>
                        setConfirm({
                          kind: "position",
                          id: position.id,
                          label: position.title,
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>

                {position.candidates.length > 0 && (
                  <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-800">
                    {position.candidates.map((candidate) => {
                      const linkedVoter = candidate.voterRef
                        ? votersById.get(candidate.voterRef)
                        : undefined;
                      return (
                        <li
                          key={candidate.id}
                          className="flex items-start justify-between gap-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            {/* Photo thumbnail / upload zone */}
                            {isDraft ? (
                              <label
                                title="Click to upload photo"
                                className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 hover:border-brand-400 dark:border-gray-600 dark:bg-gray-800"
                              >
                                {candidate.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={candidate.photoUrl}
                                    alt={candidate.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                    Photo
                                  </span>
                                )}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleUploadPhoto(candidate.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            ) : candidate.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={candidate.photoUrl}
                                alt={candidate.name}
                                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                              />
                            ) : null}

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-gray-800 dark:text-gray-100">
                                  {candidate.name}
                                </p>
                                {candidate.voterRef && (
                                  <span
                                    className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-500"
                                    title={
                                      linkedVoter
                                        ? `Linked to voter ${linkedVoter.email}`
                                        : "Linked voter no longer registered"
                                    }
                                  >
                                    {linkedVoter
                                      ? `Voter · ${linkedVoter.voterId}`
                                      : "Linked voter removed"}
                                  </span>
                                )}
                              </div>
                              {candidate.bio && (
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                  {candidate.bio}
                                </p>
                              )}
                              {isDraft && candidate.photoUrl && (
                                <button
                                  type="button"
                                  onClick={() => void handleRemovePhoto(candidate.id)}
                                  className="mt-1 text-xs text-error-500 hover:text-error-600"
                                >
                                  Remove photo
                                </button>
                              )}
                            </div>
                          </div>
                          {isDraft && (
                            <Button
                              variant="ghost"
                              size="sm"
                              ariaLabel={`Remove candidate ${candidate.name}`}
                              startIcon={<TrashBinIcon />}
                              onClick={() =>
                                setConfirm({
                                  kind: "candidate",
                                  id: candidate.id,
                                  label: candidate.name,
                                })
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {isDraft && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Add candidate to this position
                    </p>
                    <div className="mb-3">
                      <Label htmlFor={`cand-voter-${position.id}`}>
                        Quick add from registered voter (optional)
                      </Label>
                      <select
                        id={`cand-voter-${position.id}`}
                        value={draft.voterRef ?? ""}
                        disabled={voters.length === 0}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          if (!id) {
                            updateCandidateDraft(position.id, { voterRef: null });
                            return;
                          }
                          const voter = votersById.get(id);
                          updateCandidateDraft(position.id, {
                            voterRef: id,
                            name: voter ? voter.name : draft.name,
                          });
                        }}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800"
                      >
                        {voters.length === 0 ? (
                          <option value="">No registered voters yet</option>
                        ) : (
                          <>
                            <option value="">— Type a new candidate name —</option>
                            {voters.map((voter) => {
                              const used =
                                linkedVoterIdsInElection.has(voter.id) &&
                                voter.id !== draft.voterRef;
                              return (
                                <option
                                  key={voter.id}
                                  value={voter.id}
                                  disabled={used}
                                >
                                  {voter.name} — {voter.voterId}
                                  {used ? " (already a candidate)" : ""}
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {voters.length === 0 ? (
                          <>
                            Pick a voter to auto-fill the name.{" "}
                            <Link
                              href="/admin/voters"
                              className="text-brand-500 hover:text-brand-600"
                            >
                              Register voters first
                            </Link>
                          </>
                        ) : (
                          "Pick a voter to auto-fill the name, or leave on “Type a new candidate name” for an external candidate."
                        )}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                      <div>
                        <Label htmlFor={`cand-name-${position.id}`}>Name</Label>
                        <Input
                          id={`cand-name-${position.id}`}
                          value={draft.name}
                          onChange={(e) =>
                            updateCandidateDraft(position.id, { name: e.target.value })
                          }
                          placeholder="e.g. Ada Lovelace"
                          maxLength={80}
                          error={Boolean(error)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`cand-bio-${position.id}`}>Bio (optional)</Label>
                        <Input
                          id={`cand-bio-${position.id}`}
                          value={draft.bio}
                          onChange={(e) =>
                            updateCandidateDraft(position.id, { bio: e.target.value })
                          }
                          placeholder="A short pitch"
                          maxLength={280}
                        />
                      </div>
                      <Button
                        startIcon={<PlusIcon />}
                        size="sm"
                        onClick={() => handleAddCandidate(position.id)}
                      >
                        Add
                      </Button>
                    </div>
                    {error && (
                      <p role="alert" className="mt-2 text-sm text-error-500">
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {(isOpen || isClosed) && (
        <section id="tour-election-results" className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isOpen ? "Live results" : "Final results"}
            </h2>
            <div className="flex items-center gap-3">
              {isOpen && (
                <button
                  type="button"
                  onClick={refresh}
                  className="text-sm text-brand-500 hover:text-brand-600"
                >
                  Refresh
                </button>
              )}
              {isClosed && election && (
                <a
                  href={`/print/elections/${election.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-500 hover:text-brand-600"
                >
                  Print results
                </a>
              )}
            </div>
          </div>
          <ResultsList tally={resultsListInput} closed={isClosed} />
        </section>
      )}

      <Modal isOpen={confirm !== null} onClose={() => setConfirm(null)} className="m-4 max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {confirm?.kind === "election" && "Delete election"}
          {confirm?.kind === "position" && "Remove position"}
          {confirm?.kind === "candidate" && "Remove candidate"}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {confirm?.kind === "election" &&
            `Permanently delete "${confirm.label}" and everything inside it. This cannot be undone.`}
          {confirm?.kind === "position" &&
            `Removing "${confirm.label}" will also delete its candidates. This cannot be undone.`}
          {confirm?.kind === "candidate" &&
            `Remove "${confirm?.label}" from the ballot? This cannot be undone.`}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirm}>
            {confirm?.kind === "election" ? "Delete" : "Remove"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatCountdown(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "now";
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function ScheduleCountdown({
  label,
  target,
  now,
}: {
  label: string;
  target: string;
  now: Date;
}) {
  const t = new Date(target);
  const isPast = t <= now;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">
        {isPast ? "Processing…" : formatCountdown(t, now)}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}
