import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSessionData = {
  isLoggedIn: boolean;
  email?: string;
};

const sessionOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_SECRET!,
  cookieName: "birdseye_admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export function isAdminAuthConfigured() {
  return Boolean(
    process.env.ADMIN_SESSION_SECRET?.trim() &&
      process.env.ADMIN_PASSWORD?.trim(),
  );
}

export function getAllowedAdminEmails() {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminSession() {
  if (!isAdminAuthConfigured()) {
    return { isLoggedIn: false } satisfies AdminSessionData;
  }

  return getIronSession<AdminSessionData>(await cookies(), sessionOptions);
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    throw new Error("Unauthorized");
  }
  return session;
}

export { sessionOptions };
