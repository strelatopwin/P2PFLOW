import type { NextRequest } from "next/server";
import { parseMarketRequestQuery } from "@/server/market/market-query.utils";
import { getMarketResponse } from "@/server/market/market.service";
import { getAuthenticatedUserFromRequest } from "@/server/auth/auth.service";
import { hasApprovedAccess } from "@/server/access/access.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const approved = await hasApprovedAccess(user.id);
    if (!approved) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const query = parseMarketRequestQuery(request.nextUrl.searchParams);
    const payload = await getMarketResponse(query);
    return Response.json(payload);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unexpected server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
