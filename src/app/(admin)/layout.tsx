import React from "react";
import { BrandingProvider } from "@/context/BrandingContext";
import { brandColorCss } from "@/lib/brand-palette";
import { BRANDING_DEFAULTS, getBrandingByOrgId } from "@/lib/branding";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";

/**
 * Resolves the signed-in admin's organisation and brands the admin area with
 * it. Sits above the client layout, which is where the session is actually
 * enforced — here an absent session simply falls back to neutral branding
 * rather than redirecting, since that layout already handles it.
 */
export default async function AdminBrandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  let branding = BRANDING_DEFAULTS;
  if (session.adminId) {
    const admin = await db.admin.findUnique({
      where: { id: session.adminId },
      select: { organizationId: true },
    });
    if (admin) branding = await getBrandingByOrgId(admin.organizationId);
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{ __html: brandColorCss(branding.brandColor) }}
      />
      <BrandingProvider branding={branding}>{children}</BrandingProvider>
    </>
  );
}
