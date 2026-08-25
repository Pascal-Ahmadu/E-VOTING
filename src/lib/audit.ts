import { UAParser } from "ua-parser-js";
import { db } from "./db";
import { log } from "./logger";

export type ActorType = "admin" | "voter" | null;

export interface RequestMeta {
  ip: string;
  userAgent: string;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AuditEntry {
  // Canonical shape
  actorType?: ActorType;
  actorId?: string | null;
  /** Human-readable label (email for admin, Voter ID for voter). */
  actorLabel?: string | null;
  meta?: RequestMeta;

  // Common
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;

  // Legacy shape — still supported so older call sites keep working.
  adminId?: string | null;
  adminEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Pull IP, UA, geo, and device out of a request. Vercel injects geo headers
 * automatically when deployed; locally these are null. */
export function requestMeta(req: Request): RequestMeta {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  const ip = xff
    ? xff.split(",")[0]!.trim()
    : headers.get("x-real-ip") ?? "unknown";
  const userAgent = headers.get("user-agent") ?? "unknown";

  let browser: string | null = null;
  let os: string | null = null;
  let deviceType: string | null = null;
  if (userAgent && userAgent !== "unknown") {
    try {
      const ua = UAParser(userAgent);
      browser = ua.browser?.name
        ? `${ua.browser.name}${ua.browser.version ? ` ${ua.browser.version.split(".")[0]}` : ""}`
        : null;
      os = ua.os?.name
        ? `${ua.os.name}${ua.os.version ? ` ${ua.os.version}` : ""}`
        : null;
      deviceType = ua.device?.type ?? "desktop";
    } catch {
      // ua-parser-js is conservative; if parsing throws we just skip enrichment
    }
  }

  const city = decodeURIComponent(headers.get("x-vercel-ip-city") ?? "") || null;
  const region =
    decodeURIComponent(headers.get("x-vercel-ip-country-region") ?? "") || null;
  const country = headers.get("x-vercel-ip-country") || null;
  const latitudeRaw = headers.get("x-vercel-ip-latitude");
  const longitudeRaw = headers.get("x-vercel-ip-longitude");
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  return {
    ip,
    userAgent,
    browser,
    os,
    deviceType,
    city,
    region,
    country,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

/**
 * Append-only audit. Failures are logged but never thrown — we never block
 * the user-facing action because audit logging hiccuped.
 *
 * Accepts both the new canonical shape (`actorType` + `meta`) and the legacy
 * shape (`adminId`/`adminEmail`/`ip`/`userAgent`) for backwards compatibility.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const actorType: ActorType =
    entry.actorType !== undefined
      ? entry.actorType
      : entry.adminId
        ? "admin"
        : null;
  const actorId = entry.actorId ?? entry.adminId ?? null;
  const actorLabel = entry.actorLabel ?? entry.adminEmail ?? null;

  const meta = entry.meta;

  try {
    await db.auditLog.create({
      data: {
        actorType,
        actorId,
        actorLabel,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ip: meta?.ip ?? entry.ip ?? null,
        userAgent: meta?.userAgent ?? entry.userAgent ?? null,
        browser: meta?.browser ?? null,
        os: meta?.os ?? null,
        deviceType: meta?.deviceType ?? null,
        city: meta?.city ?? null,
        region: meta?.region ?? null,
        country: meta?.country ?? null,
        latitude: meta?.latitude ?? null,
        longitude: meta?.longitude ?? null,
      },
    });
  } catch (err) {
    log.error("audit_write_failed", {
      action: entry.action,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
