import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { generatePassword } from "@/lib/voter-codegen";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({ password: generatePassword() });
}
