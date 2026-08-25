import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/password";
import { getPlatformSession } from "@/lib/session";
import { requireSameOrigin } from "@/lib/csrf";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { Email, parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { log } from "@/lib/logger";

const Body = z.object({
  email: Email,
  passcode: z.string().min(1, "Passcode is required").max(128),
});

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const ip = clientIp(req);
  const limit = checkRateLimit({
    key: `platform-signin:${ip}`,
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { email, passcode } = parsed.data;

  const operator = await db.platformAdmin.findUnique({ where: { email } });
  const meta = requestMeta(req);

  if (!operator || !(await verifySecret(passcode, operator.passcodeHash))) {
    log.warn("platform_signin_failed", { email, ip });
    // organizationId stays null: this is a platform event, owned by no tenant.
    await audit({
      actorType: null,
      actorLabel: email,
      action: "platform.signin.failed",
      meta,
    });
    return NextResponse.json(
      { error: "Incorrect email or passcode" },
      { status: 401 },
    );
  }

  const session = await getPlatformSession();
  session.platformAdminId = operator.id;
  await session.save();

  await audit({
    actorType: null,
    actorId: operator.id,
    actorLabel: operator.email,
    action: "platform.signin",
    meta,
  });

  return NextResponse.json({
    operator: { id: operator.id, name: operator.name, email: operator.email },
  });
}

export async function DELETE() {
  const session = await getPlatformSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
