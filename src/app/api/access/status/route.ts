import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/server/auth/auth.service";
import { getAccessState } from "@/server/access/access.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Неавторизовано" }, { status: 401 });
    }

    const state = await getAccessState(user.id, user.email);
    return NextResponse.json(state);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Непередбачена помилка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
