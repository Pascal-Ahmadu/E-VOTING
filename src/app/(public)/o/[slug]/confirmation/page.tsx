"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { Suspense } from "react";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { useBranding } from "@/context/BrandingContext";

function ConfirmationSkeleton() {
  return (
    <div className="w-full max-w-md self-center rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <div className="flex justify-center">
        <Skeleton className="h-20 w-20" rounded="full" />
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="mx-auto h-7 w-2/3" />
        <Skeleton className="mx-auto h-4 w-3/4" />
      </div>
      <Skeleton className="mt-7 h-13 w-full" rounded="lg" />
    </div>
  );
}

function ConfirmationContent() {
  const params = useSearchParams();
  const { slug, voterIdLabel } = useBranding();
  const status = params.get("status") === "already" ? "already" : "submitted";

  const headline =
    status === "already" ? "You have already voted" : "Your ballot is in";
  const message =
    status === "already"
      ? `Our records show this ${voterIdLabel} has already submitted a ballot for this election. Each voter may submit one ballot only.`
      : "Thank you for voting. Your selections have been recorded. You may now close this window.";

  return (
    <div className="w-full max-w-md self-center rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200 sm:p-10 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success-500/10 ring-1 ring-success-500/20">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-success-500"
          aria-hidden="true"
        >
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        {headline}
      </h1>
      <p className="mt-3 text-base text-gray-500 dark:text-gray-400">{message}</p>
      <div className="mt-7 flex flex-col items-stretch gap-3">
        <Link
          href={`/o/${slug}/dashboard`}
          className="inline-flex min-h-[52px] items-center justify-center rounded-lg bg-brand-500 px-6 py-4 text-base font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600"
        >
          View live results
        </Link>
        <Link
          href={`/o/${slug}`}
          className="text-base text-gray-500 hover:text-brand-500 dark:text-gray-400"
        >
          Return to start
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationSkeleton />}>
      <ConfirmationContent />
    </Suspense>
  );
}
