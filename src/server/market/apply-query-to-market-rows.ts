import type { MarketRow, SortBy, SortOrder } from "@/types/market";

const SORT_ACCESSOR: Record<SortBy, (item: MarketRow) => number | string> = {
  pair: (item) => item.pair,
  buyRate: (item) => item.buyRate,
  sellRate: (item) => item.sellRate,
  volume24hUsd: (item) => item.volume24hUsd,
  profitPercent: (item) => item.profitPercent,
  spreadPercent: (item) => item.spreadPercent,
  lifetimeMs: (item) => item.lifetimeMs,
};

export type MarketRowsQueryOptions = {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number;
};

export function applyQueryToMarketRows(
  rows: MarketRow[],
  { search, sortBy, sortOrder, limit }: MarketRowsQueryOptions,
): MarketRow[] {
  const normalizedSearch = search.trim().toLowerCase();
  const searchedRows = normalizedSearch
    ? rows.filter((item) => {
        return (
          item.pair.toLowerCase().includes(normalizedSearch) ||
          item.buyExchange.toLowerCase().includes(normalizedSearch) ||
          item.sellExchange.toLowerCase().includes(normalizedSearch) ||
          item.network.toLowerCase().includes(normalizedSearch) ||
          item.withdrawalNetworkEntries.some((entry) =>
            entry.text.toLowerCase().includes(normalizedSearch),
          ) ||
          item.profitDisplay.toLowerCase().includes(normalizedSearch)
        );
      })
    : [...rows];

  const access = SORT_ACCESSOR[sortBy];
  searchedRows.sort((left, right) => {
    const leftValue = access(left);
    const rightValue = access(right);

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      const stringComparison = leftValue.localeCompare(rightValue);
      return sortOrder === "asc" ? stringComparison : -stringComparison;
    }

    const numericComparison = Number(leftValue) - Number(rightValue);
    return sortOrder === "asc" ? numericComparison : -numericComparison;
  });

  return searchedRows.slice(0, limit);
}
