import { cache } from "react";
import { db } from "./db";
import { log } from "./logger";
import { DEFAULT_BRAND_COLOR } from "./brand-palette";

export interface Branding {
  organizationId: string | null;
  slug: string | null;
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
 * Neutral, organisation-free fallback. Used before a tenant is resolved (the
 * platform area, the root page) and whenever a lookup fails, so a bad read
 * degrades to plain styling rather than taking the page down.
 */
export const BRANDING_DEFAULTS: Branding = {
  organizationId: null,
  slug: null,
  orgName: "Election Platform",
  orgShortName: "Elections",
  tagline: null,
  logoUrl: null,
  brandColor: DEFAULT_BRAND_COLOR,
  voterIdLabel: "Voter ID",
  emailFromName: "Election Platform",
  supportEmail: null,
};

type OrgRow = {
  id: string;
  slug: string;
  orgName: string;
  orgShortName: string;
  tagline: string | null;
  logoUrl: string | null;
  brandColor: string;
  voterIdLabel: string;
  emailFromName: string | null;
  supportEmail: string | null;
};

const SELECT = {
  id: true,
  slug: true,
  orgName: true,
  orgShortName: true,
  tagline: true,
  logoUrl: true,
  brandColor: true,
  voterIdLabel: true,
  emailFromName: true,
  supportEmail: true,
} as const;

function toBranding(row: OrgRow): Branding {
  return {
    organizationId: row.id,
    slug: row.slug,
    orgName: row.orgName,
    orgShortName: row.orgShortName,
    tagline: row.tagline,
    logoUrl: row.logoUrl,
    brandColor: row.brandColor,
    voterIdLabel: row.voterIdLabel,
    emailFromName: row.emailFromName?.trim() || row.orgName,
    supportEmail: row.supportEmail,
  };
}

/**
 * Branding for one organisation, by id.
 *
 * Wrapped in React's `cache` so the several consumers in a single render —
 * layout, page, metadata — share one query per organisation.
 */
export const getBrandingByOrgId = cache(
  async (organizationId: string): Promise<Branding> => {
    try {
      const row = await db.organization.findUnique({
        where: { id: organizationId },
        select: SELECT,
      });
      return row ? toBranding(row) : BRANDING_DEFAULTS;
    } catch (err) {
      log.error("branding_read_failed", {
        organizationId,
        error: err instanceof Error ? err.message : "unknown",
      });
      return BRANDING_DEFAULTS;
    }
  },
);

/** Branding for one organisation, by URL slug. Returns null when the slug does
 * not exist, so callers can render a 404 rather than silently showing
 * unbranded pages for a mistyped organisation. */
export const getBrandingBySlug = cache(
  async (slug: string): Promise<Branding | null> => {
    try {
      const row = await db.organization.findUnique({
        where: { slug },
        select: SELECT,
      });
      return row ? toBranding(row) : null;
    } catch (err) {
      log.error("branding_read_failed", {
        slug,
        error: err instanceof Error ? err.message : "unknown",
      });
      return null;
    }
  },
);

/**
 * Prefix for auto-generated voter IDs, derived from the organisation's short
 * name (e.g. "Acme Institute" -> "ACME"). Falls back to a neutral "VOTE" when
 * the short name has no usable letters or digits.
 */
export function voterIdPrefix(orgShortName: string): string {
  const cleaned = orgShortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 4) || "VOTE";
}
