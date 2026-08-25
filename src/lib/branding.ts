import { cache } from "react";
import { db } from "./db";
import { log } from "./logger";

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
  brandColor: "#198a44",
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

/* ------------------------------------------------------------------ */
/* Colour ramp                                                         */
/* ------------------------------------------------------------------ */

/** Tint/shade factors per step. Positive mixes toward white, negative toward
 * black. Tuned so a mid-tone seed reproduces a ramp close to the original
 * hand-picked green. */
const RAMP: ReadonlyArray<readonly [step: number, mix: number]> = [
  [25, 0.97],
  [50, 0.94],
  [100, 0.86],
  [200, 0.7],
  [300, 0.5],
  [400, 0.25],
  [500, 0],
  [600, -0.15],
  [700, -0.32],
  [800, -0.45],
  [900, -0.56],
  [950, -0.7],
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.trim().slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Build the full `--color-brand-*` ramp from one seed colour and return it as a
 * CSS rule. Injected into the document so Tailwind's `bg-brand-500` and friends
 * re-point at the organisation's colour without a rebuild.
 */
export function brandColorCss(seed: string): string {
  const hex = isHexColor(seed) ? seed : BRANDING_DEFAULTS.brandColor;
  const [r, g, b] = toRgb(hex);
  const vars = RAMP.map(([step, mix]) => {
    const target = mix >= 0 ? 255 : 0;
    const t = Math.abs(mix);
    const shade = toHex([
      r + (target - r) * t,
      g + (target - g) * t,
      b + (target - b) * t,
    ]);
    return `--color-brand-${step}:${shade};`;
  }).join("");
  return `:root{${vars}}`;
}

/**
 * Prefix for auto-generated voter IDs, derived from the organisation's short
 * name (e.g. "Acme Institute" -> "ACME"). Falls back to a neutral "VOTE" when
 * the short name has no usable letters or digits.
 */
export function voterIdPrefix(orgShortName: string): string {
  const cleaned = orgShortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 4) || "VOTE";
}
