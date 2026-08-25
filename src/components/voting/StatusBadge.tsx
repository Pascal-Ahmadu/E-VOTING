import React from "react";

export type ElectionStatus = "draft" | "open" | "closed";

const STYLES: Record<ElectionStatus, string> = {
  draft:
    "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
  open: "bg-success-500/10 text-success-600 ring-success-500/20 dark:text-success-400",
  closed:
    "bg-warning-500/10 text-warning-600 ring-warning-500/20 dark:text-warning-400",
};

const LABEL: Record<ElectionStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

export default function StatusBadge({ status }: { status: ElectionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status === "open" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
      )}
      {LABEL[status]}
    </span>
  );
}
