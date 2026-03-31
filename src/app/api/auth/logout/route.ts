import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_ACCESS_TOKEN,
  AUTH_COOKIE_REFRESH_TOKEN,
  AUTH_COOKIE_USER_ID,
} from "@/server/auth/auth.constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const expired = { path: "/", maxAge: 0 };

  response.cookies.set(AUTH_COOKIE_ACCESS_TOKEN, "", expired);
  response.cookies.set(AUTH_COOKIE_REFRESH_TOKEN, "", expired);
  response.cookies.set(AUTH_COOKIE_USER_ID, "", expired);

  return response;
}
