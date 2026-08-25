import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVoterSession } from "@/lib/session";
import { decryptVoterFields } from "@/lib/voter-pii";

export async function GET() {
  const session = await getVoterSession();
  if (!session.voterId) {
    return NextResponse.json({ voter: null }, { status: 401 });
  }
  const voter = await db.voter.findUnique({
    where: { id: session.voterId },
    select: {
      id: true,
      name: true,
      email: true,
      voterId: true,
      registeredAt: true,
    },
  });
  if (!voter) {
    session.destroy();
    return NextResponse.json({ voter: null }, { status: 401 });
  }
  return NextResponse.json({ voter: decryptVoterFields(voter) });
}
