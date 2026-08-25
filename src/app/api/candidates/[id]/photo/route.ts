import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { isRevoked } from "@/lib/revocation";
import { getElectionState } from "@/lib/election-state";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  if (await isRevoked("candidate", id)) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { id: true, name: true, photoUrl: true, position: { select: { electionId: true } } },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // Only allow photo uploads while the election is still in draft
  const state = await getElectionState(candidate.position.electionId);
  if (state.status !== "draft") {
    return NextResponse.json(
      { error: "Candidate photos can only be changed while the election is in draft" },
      { status: 409 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No photo file uploaded" }, { status: 400 });
  }
  const image = file as File;

  if (!ALLOWED_TYPES.includes(image.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG and WebP images are accepted" },
      { status: 400 },
    );
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be under 2 MB" },
      { status: 400 },
    );
  }

  // Delete old photo from Blob storage if one exists
  if (candidate.photoUrl) {
    try {
      await del(candidate.photoUrl);
    } catch {
      // Non-fatal — old blob may already be gone
    }
  }

  const ext = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`candidates/${id}.${ext}`, image, {
    access: "public",
  });

  await db.candidate.update({
    where: { id },
    data: { photoUrl: blob.url },
  });

  return NextResponse.json({ photoUrl: blob.url });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { photoUrl: true, position: { select: { electionId: true } } },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const state = await getElectionState(candidate.position.electionId);
  if (state.status !== "draft") {
    return NextResponse.json(
      { error: "Candidate photos can only be changed while the election is in draft" },
      { status: 409 },
    );
  }

  if (candidate.photoUrl) {
    try {
      await del(candidate.photoUrl);
    } catch {
      // Non-fatal
    }
    await db.candidate.update({ where: { id }, data: { photoUrl: null } });
  }

  return NextResponse.json({ ok: true });
}
