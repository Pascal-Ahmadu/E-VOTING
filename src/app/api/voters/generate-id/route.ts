import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { hashPII } from "@/lib/pii";
import { generateVoterId } from "@/lib/voter-codegen";
import { getBranding, voterIdPrefix } from "@/lib/branding";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { orgShortName } = await getBranding();
  const prefix = voterIdPrefix(orgShortName);

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = generateVoterId(prefix);
    const exists = await db.voter.findUnique({
      where: { voterIdHash: hashPII(candidate) },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ voterId: candidate });
  }
  return NextResponse.json(
    { error: "Could not generate a unique voter ID" },
    { status: 500 },
  );
}
