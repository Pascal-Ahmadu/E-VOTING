"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import StatusBadge from "@/components/voting/StatusBadge";
import { DashboardSkeleton } from "@/components/voting/skeletons";
import { apiCall } from "@/lib/api-client";

interface ResultRow {
  candidateId: string;
  name: string;
  votes: number;
}

interface PositionTally {
  positionId: string;
  title: string;
  description: string | null;
  results: ResultRow[];
  totalVotes: number;
}

type ElectionStatus = "draft" | "open" | "closed";

interface ElectionView {
  id: string;
  name: string;
  description: string | null;
  status: ElectionStatus;
  openedAt: string | null;
  closedAt: string | null;
  ballotCount: number;
  tally: PositionTally[];
}

interface DashboardData {
  open: ElectionView[];
  closed: ElectionView[];
  totalVoters: number;
}

const formatDate = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

const formatPct = (votes: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((votes / total) * 100)}%`;

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await apiCall("/api/voters/sign-out", { method: "POST" });
    router.replace("/");
  };

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const result = await apiCall<DashboardData>("/api/dashboard");
      if (!cancelled && result.ok) setData(result.data);
    };
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!data) {
    return <DashboardSkeleton />;
  }

  const hasAnything = data.open.length > 0 || data.closed.length > 0;

  return (
    <div className="w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Election dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Live tallies update every few seconds. Closed elections show final
          results.
        </p>
      </header>

      {!hasAnything && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nothing to display yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            When the administrator opens or closes an election, it appears here.
          </p>
        </div>
      )}

      {data.open.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-500" />
            </span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Live now
            </h2>
          </div>
          {data.open.map((election) => (
            <ElectionSection
              key={election.id}
              election={election}
              totalVoters={data.totalVoters}
            />
          ))}
        </section>
      )}

      {data.closed.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Final results
          </h2>
          {data.closed.map((election) => (
            <ElectionSection
              key={election.id}
              election={election}
              totalVoters={data.totalVoters}
            />
          ))}
        </section>
      )}

      <footer className="border-t border-gray-200 pt-6 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/ballot"
            className="text-sm font-medium text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400"
          >
            Go to ballot
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </footer>
    </div>
  );
}

function ElectionSection({
  election,
  totalVoters,
}: {
  election: ElectionView;
  totalVoters: number;
}) {
  const turnout =
    totalVoters === 0
      ? 0
      : Math.min(100, Math.round((election.ballotCount / totalVoters) * 100));

  return (
    <article className="space-y-4">
      <header>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {election.name}
          </h3>
          <StatusBadge status={election.status} />
        </div>
        {election.description && (
          <p className="mt-1 max-w-prose text-sm text-gray-500 dark:text-gray-400">
            {election.description}
          </p>
        )}
        {election.status === "open" && election.openedAt && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Opened {formatDate(election.openedAt)}
          </p>
        )}
        {election.status === "closed" && election.closedAt && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Closed {formatDate(election.closedAt)}
          </p>
        )}
      </header>

      <dl className="grid grid-cols-3 divide-x divide-gray-200 overflow-hidden rounded-xl bg-white text-center shadow-sm ring-1 ring-gray-200 dark:divide-gray-800 dark:bg-gray-900 dark:ring-gray-800">
        <Stat label="Votes" value={election.ballotCount} />
        <Stat label="Registered voters" value={totalVoters} />
        <Stat label="Turnout" value={`${turnout}%`} />
      </dl>

      {election.tally.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No positions configured yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {election.tally.map((tally) => {
            const visible = tally.results.slice(0, 3);
            const hidden = tally.results.length - visible.length;
            const leader = tally.results[0];
            return (
              <section
                key={tally.positionId}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
              >
                <header className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {tally.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tally.totalVotes} vote{tally.totalVotes === 1 ? "" : "s"}
                    </p>
                  </div>
                  {leader && tally.totalVotes > 0 && (
                    <span className="rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-600 dark:text-success-400">
                      {election.status === "closed" ? "Winner" : "Leading"}: {leader.name}
                    </span>
                  )}
                </header>
                {tally.results.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No candidates registered.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {visible.map((row) => {
                      const pct =
                        tally.totalVotes === 0
                          ? 0
                          : (row.votes / tally.totalVotes) * 100;
                      return (
                        <li key={row.candidateId}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-gray-800 dark:text-gray-100">
                              {row.name}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {row.votes} · {formatPct(row.votes, tally.totalVotes)}
                            </span>
                          </div>
                          <div
                            className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                            role="progressbar"
                            aria-valuenow={Math.round(pct)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${row.name} share of votes`}
                          >
                            <div
                              className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                    {hidden > 0 && (
                      <li className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                        + {hidden} more candidate{hidden === 1 ? "" : "s"}
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
