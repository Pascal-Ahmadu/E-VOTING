import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB — a logo has no business being larger

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { organizationId, adminId } = guard.value;

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

  const existing = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logoUrl: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  // Drop the previous logo so Blob storage does not accumulate orphans.
  if (existing.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Non-fatal — the old blob may already be gone.
    }
  }

  // Keyed by organisation so tenants cannot overwrite each other's logo, and
  // `addRandomSuffix` gives each upload a distinct URL, sidestepping CDN
  // caching of the previous one.
  const blob = await put(
    `branding/${organizationId}/logo.${EXT[image.type]}`,
    image,
    { access: "public", addRandomSuffix: true },
  );

  await db.organization.update({
    where: { id: organizationId },
    data: { logoUrl: blob.url },
  });

  await audit({
    organizationId,
    actorType: "admin",
    actorId: adminId,
    action: "settings.logo.update",
    targetType: "organization",
    targetId: organizationId,
    meta: requestMeta(req),
  });

  return NextResponse.json({ logoUrl: blob.url });
}

export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { organizationId, adminId } = guard.value;

  const existing = await db.organization.findUnique({
    where: { id: organizationId },
    select: { logoUrl: true },
  });

  if (existing?.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Non-fatal
    }
    await db.organization.update({
      where: { id: organizationId },
      data: { logoUrl: null },
    });
    await audit({
      organizationId,
      actorType: "admin",
      actorId: adminId,
      action: "settings.logo.remove",
      targetType: "organization",
      targetId: organizationId,
      meta: requestMeta(req),
    });
  }

  return NextResponse.json({ ok: true });
}
