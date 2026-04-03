import type { NextRequest } from "next/server";
import { API_ERROR_CODE } from "@/lib/api-error-codes";
import { responseJsonError, responseServerError } from "@/lib/api-error-response";
import { parseMarketRequestQuery } from "@/server/market/market-query.utils";
import { getMarketResponse } from "@/server/market/market.service";
import { getAuthenticatedUserFromRequest } from "@/server/auth/auth.service";
import { hasApprovedAccess } from "@/server/access/access.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return responseJsonError(401, API_ERROR_CODE.UNAUTHORIZED);
    }

    const approved = await hasApprovedAccess(user.id, user.email, user.deviceId);
    if (!approved) {
      return responseJsonError(403, API_ERROR_CODE.FORBIDDEN);
    }

    const query = parseMarketRequestQuery(request.nextUrl.searchParams);
    const payload = await getMarketResponse(query);
    return Response.json(payload);
  } catch (caught) {
    return responseServerError(caught);
  }
}
