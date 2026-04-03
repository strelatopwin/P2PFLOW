import { NextResponse } from "next/server";
import { API_ERROR_CODE } from "@/lib/api-error-codes";
import { jsonError, jsonServerError } from "@/lib/api-error-response";
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
      return jsonError(400, API_ERROR_CODE.EMAIL_REQUIRED);
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailIsValid) {
      return jsonError(400, API_ERROR_CODE.EMAIL_INVALID);
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
    return jsonServerError(caught);
  }
}
