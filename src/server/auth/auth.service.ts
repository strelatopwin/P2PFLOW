import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_SESSION } from "@/server/auth/auth.constants";
import { parseSessionToken } from "@/server/auth/auth.session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  deviceId: string;
};

export async function getAuthenticatedUserFromRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_SESSION)?.value;
  return parseSessionToken(token);
}

export async function getAuthenticatedUserFromServerCookies(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_SESSION)?.value;
  return parseSessionToken(token);
}
