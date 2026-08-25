import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVoterSession } from "@/lib/session";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { tryDecrypt } from "@/lib/pii";

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;
  const session = await getVoterSession();
  const voterId = session.voterId;
  if (voterId) {
    const voter = await db.voter.findUnique({
      where: { id: voterId },
      select: { voterId: true },
    });
    await audit({
      actorType: "voter",
      actorId: voterId,
      actorLabel: voter ? tryDecrypt(voter.voterId) : null,
      action: "voter.signout",
      meta: requestMeta(req),
    });
  }
  session.destroy();
  return NextResponse.json({ ok: true });
}
