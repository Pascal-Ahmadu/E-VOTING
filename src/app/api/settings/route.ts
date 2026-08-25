import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { BRANDING_DEFAULTS, SETTINGS_ID } from "@/lib/branding";
import { isHexColor } from "@/lib/brand-palette";

/**
 * The raw stored settings, for the admin branding form.
 *
 * Deliberately not `getBranding()`: that resolves blanks to their effective
 * values (emailFromName falls back to orgName), which would make "leave blank
 * to use the default" stop round-tripping — the field would come back filled in
 * and the next save would persist it. Rendering uses the resolved view; editing
 * needs the stored one, nulls intact.
 */
export async function GET() {
  const row = await db.organizationSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  const branding = row ?? {
    orgName: "",
    orgShortName: "",
    tagline: null,
    logoUrl: null,
    brandColor: BRANDING_DEFAULTS.brandColor,
    voterIdLabel: BRANDING_DEFAULTS.voterIdLabel,
    emailFromName: null,
    supportEmail: null,
  };
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

  const data = {
    orgName: input.orgName,
    orgShortName: input.orgShortName,
    tagline: input.tagline || null,
    brandColor: input.brandColor.toLowerCase(),
    voterIdLabel: input.voterIdLabel,
    emailFromName: input.emailFromName || null,
    supportEmail: input.supportEmail ?? null,
    updatedBy: guard.value.adminId,
  };

  const settings = await db.organizationSettings.upsert({
    where: { id: SETTINGS_ID },
    // logoUrl belongs to the dedicated upload route, so it is left alone here
    // and only seeded when the row is created for the first time.
    create: { id: SETTINGS_ID, logoUrl: BRANDING_DEFAULTS.logoUrl, ...data },
    update: data,
  });

  await audit({
    actorType: "admin",
    actorId: guard.value.adminId,
    action: "settings.branding.update",
    targetType: "settings",
    targetId: SETTINGS_ID,
    details: { orgName: data.orgName, brandColor: data.brandColor },
    meta: requestMeta(req),
  });

  return NextResponse.json({ branding: settings });
}
