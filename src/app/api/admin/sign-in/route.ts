import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/password";
import { getActiveAdminPasscodeHash } from "@/lib/credentials";
import { isRevoked } from "@/lib/revocation";
import { getAdminSession } from "@/lib/session";
import { requireSameOrigin } from "@/lib/csrf";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { audit, requestMeta } from "@/lib/audit";
import { Email, parseJson } from "@/lib/zod-helpers";
import { log } from "@/lib/logger";

const Body = z.object({
  email: Email,
  passcode: z.string().min(1, "Passcode is required").max(64),
});

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const ip = clientIp(req);
  const ipLimit = checkRateLimit({
    key: `admin-signin:${ip}`,
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.retryAfterSec);

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { email, passcode } = parsed.data;

  const emailLimit = checkRateLimit({
    key: `admin-signin:email:${email}`,
    limit: 5,
    windowMs: 5 * 60_000,
  });
  if (!emailLimit.ok) return rateLimitResponse(emailLimit.retryAfterSec);

  const meta = requestMeta(req);
  const admin = await db.admin.findUnique({ where: { email } });
  const revoked = admin ? await isRevoked("admin", admin.id) : false;
  const activeHash = admin && !revoked ? await getActiveAdminPasscodeHash(admin.id) : null;
  if (!admin || revoked || !activeHash || !(await verifySecret(passcode, activeHash))) {
    log.warn("admin_signin_failed", { email, ip });
    await audit({
      actorType: "admin",
      actorId: null,
      actorLabel: email,
      action: "admin.signin.failed",
      meta,
    });
    return NextResponse.json(
      { error: "Email or passcode is incorrect" },
      { status: 401 },
    );
  }

  const session = await getAdminSession();
  session.adminId = admin.id;
  await session.save();

  await audit({
    actorType: "admin",
    actorId: admin.id,
    actorLabel: admin.email,
    action: "admin.signin",
    meta,
  });

  return NextResponse.json({
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });
}
