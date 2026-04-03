import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ERROR_CODE } from "@/lib/api-error-codes";
import { jsonError, jsonServerError } from "@/lib/api-error-response";
import {
  AUTH_COOKIE_DEVICE,
  AUTH_COOKIE_SESSION,
} from "@/server/auth/auth.constants";
import {
  createSessionToken,
  createUserIdFromEmail,
  isValidDeviceId,
  parseSessionToken,
} from "@/server/auth/auth.session";
import { ensureAccessRequest } from "@/server/access/access.service";

type LoginBody = {
  email?: string;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
/** Long-lived: same browser profile should reuse device_id after logout/login. */
const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

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

    const cookieStore = await cookies();
    const existingToken = cookieStore.get(AUTH_COOKIE_SESSION)?.value;
    const existing = parseSessionToken(existingToken);
    const persistedDevice = cookieStore.get(AUTH_COOKIE_DEVICE)?.value;

    let deviceId: string = randomUUID();
    if (existing && existing.email === email && isValidDeviceId(existing.deviceId)) {
      deviceId = existing.deviceId;
    } else if (persistedDevice && isValidDeviceId(persistedDevice)) {
      deviceId = persistedDevice;
    }

    await ensureAccessRequest(userId, email, deviceId);

    const response = NextResponse.json({
      ok: true,
      status: "pending",
    });

    const secure = process.env.NODE_ENV === "production";
    const cookieBase = {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
    };

    response.cookies.set(AUTH_COOKIE_SESSION, createSessionToken(email, deviceId), {
      ...cookieBase,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    response.cookies.set(AUTH_COOKIE_DEVICE, deviceId, {
      ...cookieBase,
      maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (caught) {
    return jsonServerError(caught);
  }
}
