export type SortBy =
  | "pair"
  | "buyRate"
  | "sellRate"
  | "volume24hUsd"
  | "profitPercent"
  | "spreadPercent"
  | "lifetimeMs";

export type SortOrder = "asc" | "desc";

export type MarketRow = {
  id: string;
  pair: string;
  buyExchange: string;
  sellExchange: string;
  buyRate: number;
  sellRate: number;
  volume24hUsd: number;
  profitPercent: number;
  profitDisplay: string;
  spreadPercent: number;
  lifetimeMs: number;
  network: string;
  withdrawalNetworkEntries: Array<{
    text: string;
    expectedProfitIndex: number;
  }>;
};
