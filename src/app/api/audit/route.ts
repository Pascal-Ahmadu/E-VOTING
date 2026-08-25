import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { buildPage, parsePageParams } from "@/lib/pagination";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const params = parsePageParams(url.searchParams);
  const actorType = url.searchParams.get("actorType")?.trim();
  const action = url.searchParams.get("action")?.trim();
  const q = url.searchParams.get("q")?.trim();

  const where: Prisma.AuditLogWhereInput = {};
  if (actorType === "admin" || actorType === "voter") {
    where.actorType = actorType;
  }
  if (action) {
    where.action = { contains: action };
  }
  if (q) {
    where.OR = [
      { actorLabel: { contains: q } },
      { ip: { contains: q } },
      { city: { contains: q } },
      { country: { contains: q } },
    ];
  }

  const [rows, total] = await db.$transaction([
    db.auditLog.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json(
    buildPage(
      rows.map((r) => ({
        id: r.id,
        actorType: r.actorType,
        actorId: r.actorId,
        actorLabel: r.actorLabel,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        details: r.details,
        ip: r.ip,
        userAgent: r.userAgent,
        browser: r.browser,
        os: r.os,
        deviceType: r.deviceType,
        city: r.city,
        region: r.region,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      params,
    ),
  );
}
