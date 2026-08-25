import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { isHexColor } from "@/lib/brand-palette";

/**
 * The signed-in admin's own organisation, for the branding form.
 *
 * Admin-only, and scoped to the caller's organisation — the id never comes from
 * the request, so one tenant cannot read another's settings by guessing an id.
 *
 * Deliberately returns stored values with nulls intact rather than the resolved
 * view used for rendering: resolving a blank emailFromName to orgName here
 * would stop "leave blank to use the default" round-tripping.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const branding = await db.organization.findUnique({
    where: { id: guard.value.organizationId },
    select: {
      slug: true,
      orgName: true,
      orgShortName: true,
      tagline: true,
      logoUrl: true,
      brandColor: true,
      voterIdLabel: true,
      emailFromName: true,
      supportEmail: true,
    },
  });
  if (!branding) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }
  return NextResponse.json({ branding });
}

/** Optional email field — blank clears it, anything else must look like an address. */
const SupportEmail = z
  .string()
  .trim()
  .max(254)
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Enter a valid support email",
  )
  .transform((v) => (v === "" ? null : v));

const SettingsInput = z.object({
  orgName: z.string().trim().min(1, "Organisation name is required").max(120),
  orgShortName: z
    .string()
    .trim()
    .min(1, "Short name is required")
    .max(32, "Short name must be 32 characters or fewer"),
  tagline: z.string().trim().max(120).nullable().optional(),
  brandColor: z
    .string()
    .trim()
    .refine(isHexColor, "Brand colour must be a hex value like #198a44"),
  voterIdLabel: z
    .string()
    .trim()
    .min(1, "Voter ID label is required")
    .max(40, "Voter ID label is too long"),
  emailFromName: z.string().trim().max(64).nullable().optional(),
  supportEmail: SupportEmail.nullable().optional(),
});

export async function PATCH(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(req, SettingsInput);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  // The slug is deliberately not editable here: it is the tenant's URL, and
  // changing it would break every link already sent to voters.
  const branding = await db.organization.update({
    where: { id: guard.value.organizationId },
    data: {
      orgName: input.orgName,
      orgShortName: input.orgShortName,
      tagline: input.tagline || null,
      brandColor: input.brandColor.toLowerCase(),
      voterIdLabel: input.voterIdLabel,
      emailFromName: input.emailFromName || null,
      supportEmail: input.supportEmail ?? null,
    },
  });

  await audit({
    organizationId: guard.value.organizationId,
    actorType: "admin",
    actorId: guard.value.adminId,
    action: "settings.branding.update",
    targetType: "organization",
    targetId: guard.value.organizationId,
    details: { orgName: branding.orgName, brandColor: branding.brandColor },
    meta: requestMeta(req),
  });

  return NextResponse.json({ branding });
}
