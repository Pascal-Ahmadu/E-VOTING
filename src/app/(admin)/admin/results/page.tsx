"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import Breadcrumb from "@/components/common/Breadcrumb";
import StatusBadge from "@/components/voting/StatusBadge";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { ChevronRightIcon } from "@/icons";
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
}

const formatPct = (votes: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((votes / total) * 100)}%`;


export default function ResultsPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const refresh = async () => {
    const result = await apiCall<DashboardData>("/api/dashboard");
    if (result.ok) setData(result.data);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  if (!data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-4 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        {[0, 1].map((i) => (
          <section key={i} className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((j) => (
                <div
                  key={j}
                  className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
                >
                  <Skeleton className="h-5 w-1/2" />
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-2 w-full" rounded="full" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const all = [...data.open, ...data.closed];

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Results" },
        ]}
      />
      <header id="tour-results-header" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Results
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Live and final tallies for every election that has been opened.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
        >
          Refresh
        </button>
      </header>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nothing to show yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Results appear once an election is opened for voting. Open one from
            the{" "}
            <Link
              href="/admin/elections"
              className="text-brand-500 hover:text-brand-600"
            >
              elections page
            </Link>
            .
          </p>
        </div>
      ) : (
        all.map((election, i) => (
          <section key={election.id} id={i === 0 ? "tour-results-elections" : undefined} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {election.name}
                  </h2>
                  <StatusBadge status={election.status} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {election.ballotCount} ballot
                  {election.ballotCount === 1 ? "" : "s"} submitted
                </p>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href={`/api/elections/${election.id}/export`}
                  download
                  className="text-sm text-gray-500 hover:text-brand-500"
                >
                  Export CSV
                </a>
                {election.status === "closed" && (
                  <a
                    href={`/print/elections/${election.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-brand-500"
                  >
                    Print results
                  </a>
                )}
                <Link
                  href={`/admin/elections/${election.id}`}
                  className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600"
                >
                  Manage election
                  <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {election.tally.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No positions configured yet.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {election.tally.map((tally) => {
                  const leader = tally.results[0];
                  return (
                    <section
                      key={tally.positionId}
                      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
                    >
                      <header className="mb-4 flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {tally.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tally.totalVotes} vote
                            {tally.totalVotes === 1 ? "" : "s"}
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
                          {tally.results.map((row) => {
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
                                    {row.votes} ·{" "}
                                    {formatPct(row.votes, tally.totalVotes)}
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
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
