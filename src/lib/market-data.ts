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
    profitDisplay: "0.25% ($1.10, ETHEREUM)",
    spreadPercent: -0.41,
    lifetimeMs: 339000,
    network: "ETHEREUM",
    withdrawalNetworkEntries: [
      { text: "ETHEREUM ( $2.50, ~15хв. )", expectedProfitIndex: 0.25 },
    ],
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
    profitDisplay: "-1.20% (-$2.15, ETHEREUM)",
    spreadPercent: 1.15,
    lifetimeMs: 31892,
    network: "ETHEREUM",
    withdrawalNetworkEntries: [
      { text: "ETHEREUM ( $1.20, 5хв. ~ 20хв. )", expectedProfitIndex: -1.2 },
    ],
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
    profitDisplay: "-0.19% (-$0.42, ARBITRUM)",
    spreadPercent: 0.33,
    lifetimeMs: 1917000,
    network: "ARBITRUM",
    withdrawalNetworkEntries: [
      { text: "ARBITRUM ( $0.8050, ~10хв. )", expectedProfitIndex: -0.19 },
    ],
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
    profitDisplay: "-0.72% (-$0.55, BNB)",
    spreadPercent: 0.39,
    lifetimeMs: 0,
    network: "BNB",
    withdrawalNetworkEntries: [
      { text: "BNB ( $0.30, 3хв. ~ 10хв. )", expectedProfitIndex: -0.72 },
    ],
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
    profitDisplay: "0.31% ($0.366, BASE)",
    spreadPercent: -0.31,
    lifetimeMs: 367000,
    network: "BASE",
    withdrawalNetworkEntries: [
      { text: "BASE ( $0.0487, ~10хв. )", expectedProfitIndex: 0.31 },
    ],
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
    profitDisplay: "0.22% ($0.29, BASE)",
    spreadPercent: -0.27,
    lifetimeMs: 361000,
    network: "BASE",
    withdrawalNetworkEntries: [
      { text: "BASE ( $0.05, ~10хв. )", expectedProfitIndex: 0.22 },
    ],
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
    profitDisplay: "0.38% ($0.88, SOLANA)",
    spreadPercent: -0.38,
    lifetimeMs: 93200,
    network: "SOLANA",
    withdrawalNetworkEntries: [
      { text: "SOLANA ( $0.15, ~5хв. )", expectedProfitIndex: 0.38 },
    ],
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
    profitDisplay: "0.26% ($1.28, ETHEREUM)",
    spreadPercent: -0.26,
    lifetimeMs: 124000,
    network: "ETHEREUM",
    withdrawalNetworkEntries: [
      {
        text: "ARBITRUM ( $0.196, ~5хв. )",
        expectedProfitIndex: -0.4,
      },
      {
        text: "POLYGON ( $0.984, ~20хв. )",
        expectedProfitIndex: -0.2,
      },
      { text: "BNB ( $0.689, ~5хв. )", expectedProfitIndex: 0.15 },
      { text: "AXELAR ( $0.984 )", expectedProfitIndex: 0.1 },
      {
        text: "ETHEREUM ( $1.60, 5хв. ~ 15хв. )",
        expectedProfitIndex: 0.26,
      },
    ],
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
