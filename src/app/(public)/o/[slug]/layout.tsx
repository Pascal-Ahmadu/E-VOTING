import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";
import { BrandingProvider } from "@/context/BrandingContext";
import { brandColorCss } from "@/lib/brand-palette";
import { getBrandingBySlug } from "@/lib/branding";

/**
 * Everything a voter sees lives under this segment, so the tenant is resolved
 * once here from the URL slug and shared with the whole subtree. An unknown
 * slug is a 404 rather than an unbranded page, so a mistyped organisation is
 * never silently served as some default.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const branding = await getBrandingBySlug(slug);
  if (!branding) return { title: "Not found" };

  return {
    title: branding.orgShortName,
    description:
      branding.tagline ?? `${branding.orgName} — secure online voting`,
    icons: { icon: branding.logoUrl ?? "/images/favicon.ico" },
  };
}

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const branding = await getBrandingBySlug(slug);
  if (!branding) notFound();

  return (
    <>
      {/* Re-points Tailwind's --color-brand-* ramp at this organisation's
          colour. Rendered after the stylesheet so it wins on document order. */}
      <style
        dangerouslySetInnerHTML={{ __html: brandColorCss(branding.brandColor) }}
      />
      <BrandingProvider branding={branding}>{children}</BrandingProvider>
    </>
  );
}
