import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

export async function GET() {
  const session = await getAdminSession();
  if (!session.adminId) {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  const admin = await db.admin.findUnique({
    where: { id: session.adminId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!admin) {
    session.destroy();
    return NextResponse.json({ admin: null }, { status: 401 });
  }
  return NextResponse.json({ admin });
}
