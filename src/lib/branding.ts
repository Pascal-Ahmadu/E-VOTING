import { cache } from "react";
import { db } from "./db";
import { log } from "./logger";
import { DEFAULT_BRAND_COLOR } from "./brand-palette";

/** The settings row is a singleton — one deployment, one organisation. */
export const SETTINGS_ID = "singleton";

export interface Branding {
  orgName: string;
  orgShortName: string;
  tagline: string | null;
  logoUrl: string | null;
  brandColor: string;
  voterIdLabel: string;
  emailFromName: string;
  supportEmail: string | null;
}

/**
 * Neutral, organisation-free defaults. A fresh deployment boots and is fully
 * usable on these before an admin has configured anything.
 */
export const BRANDING_DEFAULTS: Branding = {
  orgName: "Election Platform",
  orgShortName: "Elections",
  tagline: null,
  logoUrl: null,
  brandColor: DEFAULT_BRAND_COLOR,
  voterIdLabel: "Voter ID",
  emailFromName: "Election Platform",
  supportEmail: null,
};

/**
 * Read the branding for this deployment.
 *
 * Wrapped in React's `cache` so the many consumers in a single render (layout,
 * page, metadata) share one query. Any read failure — most likely the table not
 * existing yet on a not-quite-migrated deployment — degrades to defaults rather
 * than taking the whole app down over cosmetics.
 */
export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const row = await db.organizationSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (!row) return BRANDING_DEFAULTS;
    return {
      orgName: row.orgName,
      orgShortName: row.orgShortName,
      tagline: row.tagline,
      logoUrl: row.logoUrl,
      brandColor: row.brandColor,
      voterIdLabel: row.voterIdLabel,
      emailFromName: row.emailFromName?.trim() || row.orgName,
      supportEmail: row.supportEmail,
    };
  } catch (err) {
    log.error("branding_read_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return BRANDING_DEFAULTS;
  }
});

/**
 * Prefix for auto-generated voter IDs, derived from the organisation's short
 * name (e.g. "Acme Institute" -> "ACME"). Falls back to a neutral "VOTE" when
 * the short name has no usable letters or digits.
 */
export function voterIdPrefix(orgShortName: string): string {
  const cleaned = orgShortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 4) || "VOTE";
}
