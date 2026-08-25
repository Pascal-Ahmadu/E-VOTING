import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifySecret } from "@/lib/password";
import { getActiveVoterPasswordHash } from "@/lib/credentials";
import { isRevoked } from "@/lib/revocation";
import { getVoterSession } from "@/lib/session";
import { requireSameOrigin } from "@/lib/csrf";
import {
  checkRateLimit,
  clientIp,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { VoterIdInput, parseJson } from "@/lib/zod-helpers";
import { audit, requestMeta } from "@/lib/audit";
import { log } from "@/lib/logger";
import { hashPII } from "@/lib/pii";
import { decryptVoterFields } from "@/lib/voter-pii";

const Body = z.object({
  /// The organisation whose sign-in page this was submitted from. The voter
  /// lookup is scoped to it, so credentials issued by one organisation cannot
  /// be used on another's page.
  slug: z.string().trim().min(1, "Organisation is required").max(64),
  voterId: VoterIdInput,
  password: z.string().min(1, "Password is required").max(64),
});

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const ip = clientIp(req);
  const ipLimit = checkRateLimit({
    key: `voter-signin:${ip}`,
    limit: 20,
    windowMs: 5 * 60_000,
  });
  if (!ipLimit.ok) return rateLimitResponse(ipLimit.retryAfterSec);

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;
  const { slug, voterId, password } = parsed.data;

  const org = await db.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }
  const organizationId = org.id;

  const idLimit = checkRateLimit({
    key: `voter-signin:id:${slug}:${voterId}`,
    limit: 5,
    windowMs: 5 * 60_000,
  });
  if (!idLimit.ok) return rateLimitResponse(idLimit.retryAfterSec);

  const meta = requestMeta(req);

  // Primary lookup is by HMAC over the encrypted voterId column. Fall back
  // to plaintext match so any pre-encryption rows still authenticate.
  const voterIdHash = hashPII(voterId);
  let voter = await db.voter.findUnique({
    where: { organizationId_voterIdHash: { organizationId, voterIdHash } },
  });
  if (!voter) {
    voter = await db.voter.findFirst({ where: { organizationId, voterId } });
  }

  const revoked = voter ? await isRevoked("voter", voter.id) : false;
  const activeHash = voter && !revoked ? await getActiveVoterPasswordHash(voter.id) : null;
  if (!voter || revoked || !activeHash || !(await verifySecret(password, activeHash))) {
    log.warn("voter_signin_failed", { voterId, ip });
    await audit({
      actorType: "voter",
      actorId: null,
      organizationId,
      actorLabel: voterId,
      action: "voter.signin.failed",
      meta,
    });
    return NextResponse.json(
      {
        error:
          "We couldn't sign you in. Check your Voter ID and password — or contact your election administrator.",
      },
      { status: 401 },
    );
  }

  const session = await getVoterSession();
  session.voterId = voter.id;
  await session.save();

  const decoded = decryptVoterFields(voter);

  await audit({
    organizationId,
    actorType: "voter",
    actorId: voter.id,
    actorLabel: decoded.voterId,
    action: "voter.signin",
    meta,
  });

  return NextResponse.json({
    voter: {
      id: voter.id,
      name: decoded.name,
      email: decoded.email,
      voterId: decoded.voterId,
    },
  });
}
