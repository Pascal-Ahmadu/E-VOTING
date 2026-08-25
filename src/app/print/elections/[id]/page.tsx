"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiCall } from "@/lib/api-client";
import { useBranding } from "@/context/BrandingContext";

interface ResultRow {
  candidateId: string;
  name: string;
  votes: number;
}

interface PositionTally {
  positionId: string;
  results: ResultRow[];
  totalVotes: number;
}

interface Position {
  id: string;
  title: string;
  description: string | null;
}

interface ElectionDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  closedAt: string | null;
  ballotCount: number;
  positions: Position[];
  tally: PositionTally[];
}

const formatPct = (votes: number, total: number) =>
  total === 0 ? "0%" : `${Math.round((votes / total) * 100)}%`;

export default function PrintResultsPage() {
  const { orgName } = useBranding();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiCall<{ election: ElectionDetail }>(`/api/elections/${params.id}`).then((result) => {
      if (!result.ok) {
        if (result.status === 401) {
          router.replace("/admin/sign-in");
          return;
        }
        setError(result.error);
        return;
      }
      setElection(result.data.election);
    });
  }, [params.id, router]);

  useEffect(() => {
    if (election) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [election]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-600">{error}</div>
    );
  }

  if (!election) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }

  const tallyMap = new Map(election.tally.map((t) => [t.positionId, t]));

  return (
    <div className="min-h-screen bg-white p-8 font-sans text-gray-900 print:p-6">
      {/* Controls — hidden when printing */}
      <div className="mb-8 flex items-center gap-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      {/* Page header */}
      <header className="mb-8 border-b border-gray-300 pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {orgName}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{election.name}</h1>
        {election.description && (
          <p className="mt-1 text-sm text-gray-500">{election.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-500">
          {election.closedAt && (
            <span>
              <span className="font-medium text-gray-700">Closed:</span>{" "}
              {new Date(election.closedAt).toLocaleString("en-NG", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </span>
          )}
          <span>
            <span className="font-medium text-gray-700">Total ballots:</span>{" "}
            {election.ballotCount}
          </span>
        </div>
      </header>

      {/* Tally per position */}
      <div className="space-y-8">
        {election.positions.map((position) => {
          const tally = tallyMap.get(position.id);
          if (!tally) return null;
          const winner = tally.results[0];
          const hasVotes = tally.totalVotes > 0;

          return (
            <section key={position.id} className="break-inside-avoid">
              <h2 className="mb-1 text-lg font-bold text-gray-900">{position.title}</h2>
              {position.description && (
                <p className="mb-2 text-sm text-gray-500">{position.description}</p>
              )}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-6">Candidate</th>
                    <th className="pb-2 pr-6 text-right">Votes</th>
                    <th className="pb-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.results.map((row, i) => (
                    <tr
                      key={row.candidateId}
                      className={`border-b border-gray-100 ${i === 0 && hasVotes ? "font-semibold" : ""}`}
                    >
                      <td className="py-2 pr-6">
                        {row.name}
                        {i === 0 && hasVotes && election.status === "closed" && (
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Winner
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-6 text-right tabular-nums">{row.votes}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatPct(row.votes, tally.totalVotes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 text-xs font-semibold text-gray-500">
                    <td className="pt-2 pr-6">Total</td>
                    <td className="pt-2 pr-6 text-right tabular-nums">{tally.totalVotes}</td>
                    <td className="pt-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 pt-4 text-xs text-gray-400">
        Printed {new Date().toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })} ·
        {orgName}
      </footer>
    </div>
  );
}
