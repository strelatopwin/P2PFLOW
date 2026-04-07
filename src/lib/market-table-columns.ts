import type { SortBy } from "@/types/market";

export const MARKET_COLUMN_KEYS = [
  "pair",
  "buyExchange",
  "sellExchange",
  "buyRate",
  "sellRate",
  "volume24hUsd",
  "profitPercent",
  "spreadPercent",
  "lifetimeMs",
  "withdrawalNetwork",
] as const;

export type MarketColumnKey = (typeof MARKET_COLUMN_KEYS)[number];

export const MANDATORY_MARKET_COLUMNS = new Set<MarketColumnKey>([
  "pair",
  "buyExchange",
  "sellExchange",
]);

export function defaultMarketColumnOrder(): MarketColumnKey[] {
  return [...MARKET_COLUMN_KEYS];
}

export function defaultMarketColumnHidden(): Record<MarketColumnKey, boolean> {
  return Object.fromEntries(
    MARKET_COLUMN_KEYS.map((key) => [key, false]),
  ) as Record<MarketColumnKey, boolean>;
}

export function marketColumnMessageKey(key: MarketColumnKey): string {
  if (key === "buyExchange") return "thBuyExchange";
  if (key === "sellExchange") return "thSellExchange";
  if (key === "withdrawalNetwork") return "thNetwork";
  return `columns.${key}`;
}

export function isMarketSortColumn(key: MarketColumnKey): key is SortBy {
  const sortKeys: readonly string[] = [
    "pair",
    "buyRate",
    "sellRate",
    "volume24hUsd",
    "profitPercent",
    "spreadPercent",
    "lifetimeMs",
  ];
  return sortKeys.includes(key);
}
