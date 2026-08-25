"use client";

import React, { useCallback, useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import Breadcrumb from "@/components/common/Breadcrumb";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { TableSkeleton } from "@/components/voting/skeletons";
import { apiCall } from "@/lib/api-client";

interface AuditRow {
  id: string;
  actorType: "admin" | "voter" | null;
  actorId: string | null;
  actorLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  createdAt: string;
}

interface AuditPage {
  data: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 25;

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
};

function formatLocation(row: AuditRow): string {
  const parts = [row.city, row.region, row.country].filter(Boolean);
  return parts.join(", ") || "—";
}

function formatDevice(row: AuditRow): string {
  const parts = [row.browser, row.os].filter(Boolean);
  return parts.join(" · ") || "—";
}

function actionStyle(action: string): string {
  if (action.endsWith(".failed"))
    return "bg-error-500/10 text-error-600 dark:text-error-400";
  if (action.startsWith("ballot."))
    return "bg-brand-500/10 text-brand-600 dark:text-brand-400";
  if (action.endsWith(".signin") || action.endsWith(".signout"))
    return "bg-success-500/10 text-success-600 dark:text-success-400";
  if (action.includes(".remove") || action.includes(".delete"))
    return "bg-warning-500/10 text-warning-600 dark:text-warning-400";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

export default function AuditPage() {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [actorType, setActorType] = useState<"" | "admin" | "voter">("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(pageNum),
      pageSize: String(PAGE_SIZE),
    });
    if (actorType) qs.set("actorType", actorType);
    if (debouncedQ) qs.set("q", debouncedQ);
    const result = await apiCall<AuditPage>(`/api/audit?${qs}`);
    if (result.ok) setPage(result.data);
    setLoading(false);
  }, [pageNum, actorType, debouncedQ]);

  useEffect(() => {
    setPageNum(1);
  }, [actorType, debouncedQ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (!page) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Audit log" },
        ]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Audit log
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every state-changing admin action and every voter authentication
          event, captured with IP, location, and device.
        </p>
      </header>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <div id="tour-audit-filters" className="grid gap-3 border-b border-gray-200 p-4 dark:border-gray-800 sm:grid-cols-[1fr_180px]">
          <Input
            id="audit-q"
            type="text"
            placeholder="Search by actor, IP, city, or country"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={64}
          />
          <select
            value={actorType}
            onChange={(e) =>
              setActorType(e.target.value as "" | "admin" | "voter")
            }
            className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">All actors</option>
            <option value="admin">Admins only</option>
            <option value="voter">Voters only</option>
          </select>
        </div>
        <div id="tour-audit-table" className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Device</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {page.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {loading ? "Loading…" : "No audit events match this filter."}
                  </td>
                </tr>
              ) : (
                page.data.map((row) => (
                  <tr key={row.id} className="text-gray-700 dark:text-gray-300">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {row.actorLabel ?? "—"}
                        </span>
                        {row.actorType && (
                          <span className="text-xs text-gray-400">
                            {row.actorType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${actionStyle(row.action)}`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatLocation(row)}</td>
                    <td className="px-4 py-3">{formatDevice(row)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.ip ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {page.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
            <span>
              Page {page.page} of {page.totalPages} · {page.total} events
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page.page <= 1}
                onClick={() => setPageNum((n) => Math.max(1, n - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page.page >= page.totalPages}
                onClick={() => setPageNum((n) => n + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
