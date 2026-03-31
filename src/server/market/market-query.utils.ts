import type { SortBy, SortOrder } from "@/types/market";
import type { MarketRequestQuery } from "@/server/market/market.types";

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

export function parseMarketRequestQuery(
  searchParams: URLSearchParams,
): MarketRequestQuery {
  const sourceMode = searchParams.get("source");

  return {
    search: searchParams.get("search") ?? "",
    sortBy: parseSortBy(searchParams.get("sortBy")),
    sortOrder: parseSortOrder(searchParams.get("sortOrder")),
    limit: parseLimit(searchParams.get("limit")),
    useMockOnly: sourceMode === "mock",
    includeDebug: searchParams.get("debug") === "1",
  };
}
