import { NextResponse } from "next/server";
import { getAdminSession, sessionOptions, type AdminSessionData } from "@/lib/admin-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export async function POST() {
  const session = await getIronSession<AdminSessionData>(
    await cookies(),
    sessionOptions,
  );
  session.destroy();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
