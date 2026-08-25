import { NextResponse } from "next/server";
import { z } from "zod";

export async function parseJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<
  | { ok: true; data: z.output<T> }
  | { ok: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue?.message ?? "Invalid request";
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 400 }),
    };
  }
  return { ok: true, data: result.data };
}

export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email");

export const VoterIdInput = z
  .string()
  .trim()
  .toUpperCase()
  .min(4, "Voter ID must be 4–32 letters, numbers or dashes")
  .max(32, "Voter ID is too long")
  .regex(/^[A-Za-z0-9-]+$/, "Voter ID must be 4–32 letters, numbers or dashes");

export const Password = z
  .string()
  .min(4, "Password must be at least 4 characters")
  .max(64, "Password is too long");

export const Name = z.string().trim().min(1, "Name is required").max(80);
export const Title = z.string().trim().min(1, "Title is required").max(80);
export const Description = z
  .string()
  .trim()
  .max(280, "Description is too long");
