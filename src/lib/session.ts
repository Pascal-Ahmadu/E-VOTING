import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export interface AdminSessionData {
  adminId?: string;
}

export interface VoterSessionData {
  voterId?: string;
}

const sharedCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

const adminOptions: SessionOptions = {
  cookieName: "evoting_admin_session",
  password: env.SESSION_SECRET,
  cookieOptions: sharedCookieOptions,
};

const voterOptions: SessionOptions = {
  cookieName: "evoting_voter_session",
  password: env.SESSION_SECRET,
  cookieOptions: sharedCookieOptions,
};

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getIronSession<AdminSessionData>(cookieStore, adminOptions);
}

export async function getVoterSession() {
  const cookieStore = await cookies();
  return getIronSession<VoterSessionData>(cookieStore, voterOptions);
}
