import { NextResponse } from "next/server";
import { AUTH_COOKIE_SESSION } from "@/server/auth/auth.constants";
import { createSessionToken, createUserIdFromEmail } from "@/server/auth/auth.session";
import { ensureAccessRequest } from "@/server/access/access.service";

type LoginBody = {
  email?: string;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() ?? "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailIsValid) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const userId = createUserIdFromEmail(email);
    await ensureAccessRequest(userId, email);

    const response = NextResponse.json({
      ok: true,
      status: "pending",
    });

    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(AUTH_COOKIE_SESSION, createSessionToken(email), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
