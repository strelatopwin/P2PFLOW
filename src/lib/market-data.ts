import type { MarketRow, SortBy, SortOrder } from "@/types/market";

const BASE_ROWS: MarketRow[] = [
  {
    id: "a2z-usdt",
    pair: "A2Z-USDT",
    buyExchange: "Binance",
    sellExchange: "Gate",
    buyRate: 0.9831,
    sellRate: 0.9871,
    volume24hUsd: 1250000,
    profitPercent: 0.25,
    spreadPercent: 0.43,
    lifetimeMs: 339000,
    network: "Ethereum",
  },
  {
    id: "aevo-usdt",
    pair: "AEVO-USDT",
    buyExchange: "Bybit",
    sellExchange: "Gate",
    buyRate: 0.4521,
    sellRate: 0.4469,
    volume24hUsd: 4239560,
    profitPercent: -1.2,
    spreadPercent: -0.08,
    lifetimeMs: 31892,
    network: "Ethereum",
  },
  {
    id: "aidoge-usdt",
    pair: "AIDOGE-USDT",
    buyExchange: "Mexc",
    sellExchange: "Gate",
    buyRate: 0.0000002119,
    sellRate: 0.0000002112,
    volume24hUsd: 5960000,
    profitPercent: -0.19,
    spreadPercent: -0.03,
    lifetimeMs: 1917000,
    network: "Arbitrum",
  },
  {
    id: "ai-usdt",
    pair: "AI-USDT",
    buyExchange: "HTX",
    sellExchange: "Gate",
    buyRate: 0.4612,
    sellRate: 0.4594,
    volume24hUsd: 3272530,
    profitPercent: -0.72,
    spreadPercent: 0.13,
    lifetimeMs: 0,
    network: "BNB Chain",
  },
  {
    id: "aixbt-usdt-binance",
    pair: "AIXBT-USDT",
    buyExchange: "BingX",
    sellExchange: "BitGet",
    buyRate: 0.2242,
    sellRate: 0.2249,
    volume24hUsd: 77593.26,
    profitPercent: 0.31,
    spreadPercent: 0.12,
    lifetimeMs: 367000,
    network: "Base",
  },
  {
    id: "aixbt-usdt-kucoin",
    pair: "AIXBT-USDT",
    buyExchange: "BingX",
    sellExchange: "Kucoin",
    buyRate: 0.2236,
    sellRate: 0.2242,
    volume24hUsd: 72425.31,
    profitPercent: 0.22,
    spreadPercent: 0.18,
    lifetimeMs: 361000,
    network: "Base",
  },
  {
    id: "sol-usdt",
    pair: "SOL-USDT",
    buyExchange: "Kraken",
    sellExchange: "Binance",
    buyRate: 183.24,
    sellRate: 183.93,
    volume24hUsd: 24900340,
    profitPercent: 0.38,
    spreadPercent: 0.38,
    lifetimeMs: 93200,
    network: "Solana",
  },
  {
    id: "eth-usdt",
    pair: "ETH-USDT",
    buyExchange: "Bybit",
    sellExchange: "Coinbase",
    buyRate: 3521.12,
    sellRate: 3530.31,
    volume24hUsd: 52700000,
    profitPercent: 0.26,
    spreadPercent: 0.26,
    lifetimeMs: 124000,
    network: "Ethereum",
  },
];

const SORT_ACCESSOR: Record<SortBy, (item: MarketRow) => number | string> = {
  pair: (item) => item.pair,
  buyRate: (item) => item.buyRate,
  sellRate: (item) => item.sellRate,
  volume24hUsd: (item) => item.volume24hUsd,
  profitPercent: (item) => item.profitPercent,
  spreadPercent: (item) => item.spreadPercent,
  lifetimeMs: (item) => item.lifetimeMs,
};

type QueryOptions = {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number;
};

export function applyQueryToMarketRows(
  rows: MarketRow[],
  { search, sortBy, sortOrder, limit }: QueryOptions
): MarketRow[] {
  const normalizedSearch = search.trim().toLowerCase();
  const searchedRows = normalizedSearch
    ? rows.filter((item) => {
        return (
          item.pair.toLowerCase().includes(normalizedSearch) ||
          item.buyExchange.toLowerCase().includes(normalizedSearch) ||
          item.sellExchange.toLowerCase().includes(normalizedSearch) ||
          item.network.toLowerCase().includes(normalizedSearch)
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

export function getMarketRows({
  search,
  sortBy,
  sortOrder,
  limit,
}: QueryOptions): MarketRow[] {
  return applyQueryToMarketRows(BASE_ROWS, {
    search,
    sortBy,
    sortOrder,
    limit,
  });
}
