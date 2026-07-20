import { NextResponse } from "next/server";
import {
  getAdminSession,
  getAllowedAdminEmails,
  isAdminAuthConfigured,
  sessionOptions,
  type AdminSessionData,
} from "@/lib/admin-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { error: "Admin auth is not configured." },
        { status: 503 },
      );
    }

    let body: LoginBody;
    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const allowed = getAllowedAdminEmails();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (allowed.length > 0 && !allowed.includes(email)) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const session = await getIronSession<AdminSessionData>(
      await cookies(),
      sessionOptions,
    );
    session.isLoggedIn = true;
    session.email = email;
    await session.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin login failed:", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({
    isLoggedIn: session.isLoggedIn,
    email: session.isLoggedIn ? session.email : undefined,
  });
}
