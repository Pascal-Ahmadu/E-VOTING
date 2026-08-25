"use client";

import React, { createContext, useContext } from "react";
import type { Branding } from "@/lib/branding";

const BrandingContext = createContext<Branding | null>(null);

/**
 * Makes the organisation's branding available to client components. The value
 * is read once on the server in the root layout and passed down, so there is no
 * fetch waterfall and no flash of default branding.
 */
export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: React.ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): Branding {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error("useBranding must be used inside a BrandingProvider");
  }
  return value;
}
