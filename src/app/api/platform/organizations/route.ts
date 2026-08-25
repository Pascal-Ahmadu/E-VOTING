import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { hashSecret } from "@/lib/password";
import { Email, Name, parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { DEFAULT_BRAND_COLOR } from "@/lib/brand-palette";

/** Every organisation on the platform, with a headline count of each one's
 * admins, voters and elections. Platform operators only. */
export async function GET() {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.response;

  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      orgName: true,
      orgShortName: true,
      createdAt: true,
      _count: { select: { admins: true, voters: true, elections: true } },
    },
  });

  return NextResponse.json({
    organizations: organizations.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

/** Slugs become URLs, so keep them to the characters that survive one intact. */
const Slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(40, "Slug is too long")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Slug may contain lowercase letters, numbers and dashes",
  )
  // Would collide with the platform's own paths.
  .refine((v) => !["admin", "platform", "api", "o"].includes(v), "That slug is reserved");

const Body = z.object({
  slug: Slug,
  orgName: z.string().trim().min(1, "Organisation name is required").max(120),
  orgShortName: z.string().trim().min(1, "Short name is required").max(32),
  adminName: Name,
  adminEmail: Email,
  adminPasscode: z.string().min(8, "Passcode must be at least 8 characters").max(128),
});

/**
 * Creates an organisation together with its first admin, in one transaction —
 * a tenant with no way to sign in would be useless, and a half-created one
 * would need manual repair.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.response;

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const passcodeHash = await hashSecret(input.adminPasscode);

  let organization;
  try {
    organization = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug: input.slug,
          orgName: input.orgName,
          orgShortName: input.orgShortName,
          brandColor: DEFAULT_BRAND_COLOR,
        },
        select: { id: true, slug: true, orgName: true, orgShortName: true, createdAt: true },
      });
      await tx.admin.create({
        data: {
          organizationId: org.id,
          name: input.adminName,
          email: input.adminEmail,
          passcodeHash,
        },
      });
      return org;
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      if (fields.includes("slug")) {
        return NextResponse.json(
          { error: "That slug is already taken" },
          { status: 409 },
        );
      }
      // Admin email is unique across the platform, since one admin belongs to
      // exactly one organisation.
      return NextResponse.json(
        { error: "An admin with this email already exists" },
        { status: 409 },
      );
    }
    throw err;
  }

  await audit({
    organizationId: organization.id,
    actorType: null,
    actorId: guard.value.platformAdminId,
    action: "platform.organization.create",
    targetType: "organization",
    targetId: organization.id,
    details: { slug: organization.slug, adminEmail: input.adminEmail },
    meta: requestMeta(req),
  });

  return NextResponse.json(
    { organization: { ...organization, createdAt: organization.createdAt.toISOString() } },
    { status: 201 },
  );
}
