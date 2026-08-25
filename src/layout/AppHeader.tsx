"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { useSidebar } from "@/context/SidebarContext";
import { apiCall } from "@/lib/api-client";

interface AdminInfo {
  id: string;
  name: string;
  email: string;
}

const AppHeader: React.FC = () => {
  const router = useRouter();
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiCall<{ admin: AdminInfo | null }>("/api/admin/me").then((result) => {
      if (cancelled) return;
      if (result.ok && result.data.admin) setAdmin(result.data.admin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const handleSignOut = async () => {
    await apiCall("/api/admin/sign-out", { method: "POST" });
    router.replace("/admin/sign-in");
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
          <path
            d="M1 1h16M1 7h16M1 13h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex-1" />

      <div id="tour-header-actions" className="flex items-center gap-3">
        {admin && (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {admin.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{admin.email}</p>
          </div>
        )}
        <ThemeToggleButton />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("start-admin-tour"))}
          title="Take a tour"
          aria-label="Take a tour"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 17v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="8" r="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
