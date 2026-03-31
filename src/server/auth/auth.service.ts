import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_ACCESS_TOKEN } from "@/server/auth/auth.constants";
import { createSupabaseServerClient } from "@/server/supabase/supabase.server";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export async function getAuthenticatedUserFromAccessToken(
  accessToken: string | undefined
): Promise<AuthenticatedUser | null> {
  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? "",
  };
}

export async function getAuthenticatedUserFromRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_ACCESS_TOKEN)?.value;
  return getAuthenticatedUserFromAccessToken(token);
}

export async function getAuthenticatedUserFromServerCookies(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_ACCESS_TOKEN)?.value;
  return getAuthenticatedUserFromAccessToken(token);
}
