"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import { apiCall } from "@/lib/api-client";
import SystemTour from "@/components/ui/tour/SystemTour";

interface AdminMe {
  admin: { id: string; name: string; email: string } | null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiCall<AdminMe>("/api/admin/me").then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data.admin) {
        router.replace("/admin/sign-in");
        return;
      }
      setAuthChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const sidebarMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[260px]"
      : "lg:ml-[80px]";

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <span
          role="status"
          aria-label="Verifying session"
          className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-brand-500/40 border-r-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 xl:flex">
      <SystemTour />
      <AppSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${sidebarMargin}`}>
        <AppHeader />
        <div className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
