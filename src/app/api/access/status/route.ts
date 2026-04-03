import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_ERROR_CODE } from "@/lib/api-error-codes";
import { jsonError, jsonServerError } from "@/lib/api-error-response";
import { getAuthenticatedUserFromRequest } from "@/server/auth/auth.service";
import { getAccessState } from "@/server/access/access.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return jsonError(401, API_ERROR_CODE.UNAUTHORIZED);
    }

    const state = await getAccessState(user.id, user.email, user.deviceId);
    return NextResponse.json(state);
  } catch (caught) {
    return jsonServerError(caught);
  }
}
