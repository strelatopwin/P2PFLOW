import { NextResponse } from "next/server";
import { AUTH_COOKIE_SESSION } from "@/server/auth/auth.constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = { path: "/", maxAge: 0 };

  response.cookies.set(AUTH_COOKIE_SESSION, "", expired);

  return response;
}
