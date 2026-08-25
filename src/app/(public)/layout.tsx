import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import React from "react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggleButton />
      </div>
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        {children}
      </div>
    </main>
  );
}
