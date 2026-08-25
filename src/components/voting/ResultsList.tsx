import React from "react";

export interface ResultRow {
  candidateId: string;
  name: string;
  votes: number;
}

export interface PositionTally {
  positionId: string;
  title: string;
  results: ResultRow[];
  totalVotes: number;
}

interface Props {
  tally: PositionTally[];
  topN?: number;
  closed?: boolean;
}

const formatPct = (votes: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((votes / total) * 100)}%`;

export default function ResultsList({ tally, topN, closed }: Props) {
  if (tally.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No positions configured yet.
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tally.map(({ positionId, title, results, totalVotes }) => {
        const leader = results[0];
        const visible = topN ? results.slice(0, topN) : results;
        const hidden = results.length - visible.length;
        return (
          <section
            key={positionId}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
          >
            <header className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                </p>
              </div>
              {leader && totalVotes > 0 && (
                <span className="rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-600 dark:text-success-400">
                  {closed ? "Winner" : "Leading"}: {leader.name}
                </span>
              )}
            </header>
            {results.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No candidates registered.
              </p>
            ) : (
              <ul className="space-y-3">
                {visible.map((row) => {
                  const pct = totalVotes === 0 ? 0 : (row.votes / totalVotes) * 100;
                  return (
                    <li key={row.candidateId}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-100">
                          {row.name}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {row.votes} · {formatPct(row.votes, totalVotes)}
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
  );
}
