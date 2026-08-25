"use client";

import React from "react";
import { useBranding } from "@/context/BrandingContext";

/**
 * The organisation's uploaded logo, or nothing.
 *
 * Deliberately renders null when no logo is set: every call site pairs this
 * with its own wordmark, so a typographic fallback here would print the short
 * name twice on a deployment that has not uploaded a logo.
 *
 * Plain <img> rather than next/image — the logo lives in Blob storage, and the
 * codebase already renders remote blob images this way (see candidate photos)
 * so no `images.remotePatterns` entry is needed.
 */
export default function BrandMark({
  className = "h-12 w-auto",
}: {
  className?: string;
}) {
  const { logoUrl, orgName } = useBranding();

  if (!logoUrl) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={orgName} className={className} />
  );
}
