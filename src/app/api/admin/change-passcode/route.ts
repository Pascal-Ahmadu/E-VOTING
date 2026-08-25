import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/password";
import {
  getActiveAdminPasscodeHash,
  rotateAdminPasscode,
} from "@/lib/credentials";
import { isRevoked } from "@/lib/revocation";
import { requireSameOrigin } from "@/lib/csrf";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { audit, requestMeta } from "@/lib/audit";
import { Email, parseJson } from "@/lib/zod-helpers";

const Body = z
  .object({
    email: Email,
    currentPasscode: z.string().min(1, "Current passcode is required"),
    newPasscode: z.string().min(4, "New passcode must be at least 4 characters").max(64),
  })
  .refine((d) => d.newPasscode !== d.currentPasscode, {
    message: "New passcode must differ from the current one",
    path: ["newPasscode"],
  });

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const ip = clientIp(req);
  const limit = checkRateLimit({
    key: `admin-changepasscode:${ip}`,
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { email, currentPasscode, newPasscode } = parsed.data;

  const admin = await db.admin.findUnique({ where: { email } });
  const revoked = admin ? await isRevoked("admin", admin.id) : false;
  const activeHash = admin && !revoked ? await getActiveAdminPasscodeHash(admin.id) : null;
  if (!admin || revoked || !activeHash || !(await verifySecret(currentPasscode, activeHash))) {
    return NextResponse.json(
      { error: "Email or current passcode is incorrect" },
      { status: 401 },
    );
  }

  await rotateAdminPasscode(admin.id, newPasscode);

  const meta = requestMeta(req);
  await audit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: "admin.change_passcode",
    targetType: "admin",
    targetId: admin.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
