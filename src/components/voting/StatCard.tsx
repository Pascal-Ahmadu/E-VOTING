import React from "react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning";
}

const TONE_RING: Record<NonNullable<Props["tone"]>, string> = {
  default: "ring-gray-200 dark:ring-gray-800",
  success: "ring-success-500/30",
  warning: "ring-warning-500/30",
};

const TONE_ICON: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-brand-500/10 text-brand-500",
  success: "bg-success-500/10 text-success-500",
  warning: "bg-warning-500/10 text-warning-500",
};

export default function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: Props) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${TONE_RING[tone]} dark:bg-gray-900`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {hint}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
