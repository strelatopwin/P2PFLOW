import type { MarketRow, SortBy, SortOrder } from "@/types/market";

export type MarketRequestQuery = {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number;
  useMockOnly: boolean;
  includeDebug: boolean;
};

export type MarketResponseMeta = {
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
  limit: number;
  total: number;
  source: "live" | "mock";
  updatedAt: string;
  error?: string | null;
};

export type MarketResponsePayload = {
  rows: MarketRow[];
  meta: MarketResponseMeta;
};
