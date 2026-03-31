import type { NextRequest } from "next/server";
import { getMarketRows } from "@/lib/market-data";
import type { SortBy, SortOrder } from "@/types/market";

const VALID_SORT_FIELDS: SortBy[] = [
  "pair",
  "buyRate",
  "sellRate",
  "volume24hUsd",
  "profitPercent",
  "spreadPercent",
  "lifetimeMs",
];

function parseSortBy(value: string | null): SortBy {
  if (value && VALID_SORT_FIELDS.includes(value as SortBy)) {
    return value as SortBy;
  }
  return "profitPercent";
}

function parseSortOrder(value: string | null): SortOrder {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return "desc";
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return Math.min(parsed, 200);
  }
  return 100;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = params.get("search") ?? "";
  const sortBy = parseSortBy(params.get("sortBy"));
  const sortOrder = parseSortOrder(params.get("sortOrder"));
  const limit = parseLimit(params.get("limit"));

  const rows = getMarketRows({
    search,
    sortBy,
    sortOrder,
    limit,
  });

  return Response.json({
    rows,
    meta: {
      search,
      sortBy,
      sortOrder,
      limit,
      total: rows.length,
      updatedAt: new Date().toISOString(),
    },
  });
}
