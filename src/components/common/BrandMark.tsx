"use client";

import React from "react";
import { useBranding } from "@/context/BrandingContext";

/**
 * The organisation's logo, with a typographic fallback for deployments that
 * have not uploaded one. Uploaded logos are rendered as-is — no dark-mode
 * inversion, since a tenant's logo may well be full colour.
 *
 * Plain <img> rather than next/image: the logo lives in Blob storage, and the
 * codebase already renders remote blob images this way (see candidate photos)
 * so no `images.remotePatterns` entry is needed.
 */
export default function BrandMark({
  className = "h-12 w-auto",
}: {
  className?: string;
}) {
  const { logoUrl, orgShortName, orgName } = useBranding();

  if (!logoUrl) {
    return (
      <span
        className="flex items-center text-2xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400"
        aria-label={orgName}
      >
        {orgShortName}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt={orgName} className={className} />
  );
}
