import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { BRANDING_DEFAULTS, SETTINGS_ID } from "@/lib/branding";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB — a logo has no business being larger

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** The settings row may not exist yet on a fresh install, so seed it with
 * defaults before attaching a logo. */
async function ensureSettingsRow() {
  return db.organizationSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      orgName: BRANDING_DEFAULTS.orgName,
      orgShortName: BRANDING_DEFAULTS.orgShortName,
      brandColor: BRANDING_DEFAULTS.brandColor,
      voterIdLabel: BRANDING_DEFAULTS.voterIdLabel,
    },
    update: {},
  });
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No logo file uploaded" }, { status: 400 });
  }
  const image = file as File;

  if (!ALLOWED_TYPES.includes(image.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP and SVG logos are accepted" },
      { status: 400 },
    );
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 1 MB" }, { status: 400 });
  }

  const existing = await ensureSettingsRow();

  // Drop the previous logo so Blob storage does not accumulate orphans.
  if (existing.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Non-fatal — the old blob may already be gone.
    }
  }

  // `addRandomSuffix` gives each upload a distinct URL, which sidesteps CDN
  // caching of the previous logo at a fixed path.
  const blob = await put(`branding/logo.${EXT[image.type]}`, image, {
    access: "public",
    addRandomSuffix: true,
  });

  await db.organizationSettings.update({
    where: { id: SETTINGS_ID },
    data: { logoUrl: blob.url, updatedBy: guard.value.adminId },
  });

  await audit({
    actorType: "admin",
    actorId: guard.value.adminId,
    action: "settings.logo.update",
    targetType: "settings",
    targetId: SETTINGS_ID,
    meta: requestMeta(req),
  });

  return NextResponse.json({ logoUrl: blob.url });
}

export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const existing = await db.organizationSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { logoUrl: true },
  });

  if (existing?.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Non-fatal
    }
    await db.organizationSettings.update({
      where: { id: SETTINGS_ID },
      data: { logoUrl: null, updatedBy: guard.value.adminId },
    });
    await audit({
      actorType: "admin",
      actorId: guard.value.adminId,
      action: "settings.logo.remove",
      targetType: "settings",
      targetId: SETTINGS_ID,
      meta: requestMeta(req),
    });
  }

  return NextResponse.json({ ok: true });
}
