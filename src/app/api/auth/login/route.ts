import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/supabase.server";
import {
  AUTH_COOKIE_ACCESS_TOKEN,
  AUTH_COOKIE_REFRESH_TOKEN,
  AUTH_COOKIE_USER_ID,
} from "@/server/auth/auth.constants";
import { ensureAccessRequest } from "@/server/access/access.service";

type LoginBody = {
  email?: string;
  password?: string;
};

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Invalid credentials" },
        { status: 401 }
      );
    }

    await ensureAccessRequest(data.user.id, data.user.email ?? email);

    const response = NextResponse.json({
      ok: true,
      status: "pending",
    });

    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(AUTH_COOKIE_ACCESS_TOKEN, data.session.access_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    response.cookies.set(AUTH_COOKIE_REFRESH_TOKEN, data.session.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    response.cookies.set(AUTH_COOKIE_USER_ID, data.user.id, {
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
