import type { NextRequest } from "next/server";
import { parseMarketRequestQuery } from "@/server/market/market-query.utils";
import { getMarketResponse } from "@/server/market/market.service";

export async function GET(request: NextRequest) {
  const query = parseMarketRequestQuery(request.nextUrl.searchParams);
  const payload = await getMarketResponse(query);
  return Response.json(payload);
}
