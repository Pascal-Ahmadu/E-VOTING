"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import Breadcrumb from "@/components/common/Breadcrumb";
import StatCard from "@/components/voting/StatCard";
import StatusBadge from "@/components/voting/StatusBadge";
import {
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/voting/skeletons";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { apiCall } from "@/lib/api-client";
import {
  BoxIconLine,
  ChevronRightIcon,
  GroupIcon,
  PieChartIcon,
  PlusIcon,
  ShootingStarIcon,
} from "@/icons";

type ElectionStatus = "draft" | "open" | "closed";

interface ElectionRow {
  id: string;
  name: string;
  description: string | null;
  status: ElectionStatus;
  positionCount: number;
  ballotCount: number;
}

interface ElectionsPage {
  data: ElectionRow[];
  total: number;
}

interface VotersSummary {
  total: number;
}

export default function DashboardPage() {
  const [elections, setElections] = useState<ElectionsPage | null>(null);
  const [voters, setVoters] = useState<VotersSummary | null>(null);

  useEffect(() => {
    Promise.all([
      apiCall<ElectionsPage>("/api/elections?pageSize=5"),
      apiCall<VotersSummary>("/api/voters?pageSize=1"),
    ]).then(([electionsRes, votersRes]) => {
      if (electionsRes.ok) setElections(electionsRes.data);
      if (votersRes.ok) setVoters({ total: votersRes.data.total });
    });
  }, []);

  if (!elections || !voters) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <StatCardsSkeleton count={4} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 lg:col-span-2 dark:bg-gray-900 dark:ring-gray-800">
            <Skeleton className="mb-4 h-5 w-40" />
            <TableSkeleton rows={5} columns={2} />
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <Skeleton className="mb-4 h-5 w-32" />
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-3/4" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const draftCount = elections.data.filter((e) => e.status === "draft").length;
  const closedCount = elections.data.filter((e) => e.status === "closed").length;
  const openElection = elections.data.find((e) => e.status === "open");
  const totalBallots = elections.data.reduce((sum, e) => sum + e.ballotCount, 0);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A summary of your elections, voters, and ballots cast.
        </p>
      </header>

      <div id="tour-stat-cards" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Elections"
          value={elections.total}
          hint={`${draftCount} draft · ${closedCount} closed (in last 5)`}
          icon={<BoxIconLine />}
        />
        <StatCard
          label="Currently open"
          value={openElection ? openElection.name : "None"}
          hint={openElection ? "Voting in progress" : "No active ballot"}
          icon={<ShootingStarIcon />}
          tone={openElection ? "success" : "default"}
        />
        <StatCard
          label="Registered voters"
          value={voters.total}
          hint={voters.total === 0 ? "Add voters before opening" : undefined}
          icon={<GroupIcon />}
          tone={voters.total === 0 ? "warning" : "default"}
        />
        <StatCard
          label="Recent ballots cast"
          value={totalBallots}
          hint="In last 5 elections"
          icon={<PieChartIcon />}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div id="tour-recent-elections" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 lg:col-span-2 dark:bg-gray-900 dark:ring-gray-800">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent elections
            </h2>
            <Link
              href="/admin/elections"
              className="text-sm text-brand-500 hover:text-brand-600"
            >
              View all
            </Link>
          </div>

          {elections.data.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No elections yet. Create one to get started.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-800">
              {elections.data.map((election) => (
                <li key={election.id}>
                  <Link
                    href={`/admin/elections/${election.id}`}
                    className="flex items-center justify-between gap-3 py-3 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-900 dark:text-white">
                          {election.name}
                        </p>
                        <StatusBadge status={election.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {election.positionCount} position
                        {election.positionCount === 1 ? "" : "s"}
                        {" · "}
                        {election.ballotCount} ballot
                        {election.ballotCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-gray-300"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div id="tour-quick-actions" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick actions
          </h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                href="/admin/elections"
                className="flex items-center gap-2 text-brand-500 hover:text-brand-600"
              >
                <PlusIcon /> Create an election
              </Link>
            </li>
            <li>
              <Link
                href="/admin/voters"
                className="flex items-center gap-2 text-brand-500 hover:text-brand-600"
              >
                <PlusIcon /> Register voters
              </Link>
            </li>
            <li>
              <Link
                href="/admin/results"
                className="flex items-center gap-2 text-brand-500 hover:text-brand-600"
              >
                <PieChartIcon /> View results
              </Link>
            </li>
          </ul>

          {voters.total === 0 && (
            <div className="mt-5 rounded-xl bg-warning-500/10 p-3 text-xs text-warning-600 dark:text-warning-400">
              No voters registered yet. Voters cannot sign in until you add them
              from the Voters page.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
