import type { NextRequest } from "next/server";
import { applyQueryToMarketRows, getMarketRows } from "@/lib/market-data";
import { getLiveMarketRows } from "@/lib/profit-arbitrage";
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
  const sourceMode = params.get("source");
  const useMockOnly = sourceMode === "mock";
  const shouldIncludeDebug = params.get("debug") === "1";

  let rows = getMarketRows({
    search,
    sortBy,
    sortOrder,
    limit,
  });
  let source: "live" | "mock" = "mock";
  let error: string | null = null;

  if (!useMockOnly) {
    try {
      const liveRows = await getLiveMarketRows(Math.max(limit * 3, 150));
      rows = applyQueryToMarketRows(liveRows, {
        search,
        sortBy,
        sortOrder,
        limit,
      });
      source = "live";
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unknown live error";
    }
  }

  return Response.json({
    rows,
    meta: {
      search,
      sortBy,
      sortOrder,
      limit,
      total: rows.length,
      source,
      updatedAt: new Date().toISOString(),
      ...(shouldIncludeDebug ? { error } : {}),
    },
  });
}
