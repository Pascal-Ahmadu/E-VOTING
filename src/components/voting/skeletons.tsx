import React from "react";
import Skeleton from "@/components/ui/skeleton/Skeleton";

export function BallotSkeleton() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <header className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4 sm:h-9" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </header>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-1/2" />
          </div>
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="flex items-start gap-4 rounded-xl border-2 border-gray-100 p-4 dark:border-gray-800"
            >
              <Skeleton className="h-7 w-7" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="w-full max-w-5xl space-y-8">
      <header className="space-y-3">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </header>
      {[0, 1].map((i) => (
        <article key={i} className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-200 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:divide-gray-800 dark:bg-gray-900 dark:ring-gray-800">
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-2 px-4 py-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((j) => (
              <div
                key={j}
                className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
              >
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
                {[0, 1, 2].map((k) => (
                  <div key={k} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full" rounded="full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10" rounded="xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <table className="min-w-full">
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-4">
                  <Skeleton className="h-4 w-3/4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
        >
          <div className="flex justify-between">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-16" rounded="full" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-8" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-8" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ElectionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-1/3" />
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-6 w-20" rounded="full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      {[0, 1].map((i) => (
        <article
          key={i}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-8 w-20" rounded="lg" />
          </div>
          {[0, 1].map((j) => (
            <div key={j} className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-8 w-20" rounded="lg" />
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
