import { applyQueryToMarketRows, getMarketRows } from "@/lib/market-data";
import { fetchProfitArbitrageWebData } from "@/server/profit-arbitrage-client/profit-arbitrage-client";
import type {
  ProfitArbitrageRawWebDataRow,
  ProfitArbitrageRawChain,
} from "@/server/profit-arbitrage-client/profit-arbitrage-client.types";
import type {
  MarketRequestQuery,
  MarketResponsePayload,
} from "@/server/market/market.types";
import type { MarketRow } from "@/types/market";

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCase(value: string): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function selectNetwork(
  chainsBuy: ProfitArbitrageRawChain[] | undefined,
  chainsSell: ProfitArbitrageRawChain[] | undefined,
): string {
  const buyChains = new Set(
    (chainsBuy ?? [])
      .map((item) => (item.chain ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  for (const item of chainsSell ?? []) {
    const chain = (item.chain ?? "").trim().toLowerCase();
    if (chain && buyChains.has(chain)) {
      return chain.toUpperCase();
    }
  }
  const fallback = (chainsBuy?.[0]?.chain ?? chainsSell?.[0]?.chain ?? "")
    .trim()
    .toLowerCase();
  return fallback ? fallback.toUpperCase() : "UNKNOWN";
}

function normalizePair(row: ProfitArbitrageRawWebDataRow): string {
  if (row.originalSymbol) {
    return row.originalSymbol.split("|")[0] ?? row.originalSymbol;
  }
  return row.uniSymbol ?? row.symbol ?? "UNKNOWN-USDT";
}

function normalizeLiveRow(
  row: ProfitArbitrageRawWebDataRow,
  index: number,
): MarketRow {
  const pair = normalizePair(row);
  const buyRate = asNumber(row.buyPriceAvg);
  const sellRate = asNumber(row.sellPriceAvg);
  const spreadPercent =
    buyRate > 0 ? ((sellRate - buyRate) / buyRate) * 100 : 0;
  const buyExchange = titleCase(row.exchangeBuy ?? "Unknown");
  const sellExchange = titleCase(row.exchangeSell ?? "Unknown");

  return {
    id: `${row.symbol ?? "asset"}-${buyExchange}-${sellExchange}-${index}`,
    pair,
    buyExchange,
    sellExchange,
    buyRate,
    sellRate,
    volume24hUsd: asNumber(row.volumeUsd ?? row.volume),
    profitPercent: asNumber(row.profitIndexAvg),
    spreadPercent,
    lifetimeMs: asNumber(row.lifetime),
    network: selectNetwork(row.chainsBuy, row.chainsSell),
  };
}

export async function getMarketResponse(
  query: MarketRequestQuery,
): Promise<MarketResponsePayload> {
  const { search, sortBy, sortOrder, limit, useMockOnly, includeDebug } = query;

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
      const livePayload = await fetchProfitArbitrageWebData(
        Math.max(limit * 3, 150),
      );
      const normalizedLiveRows = livePayload.map((row, index) =>
        normalizeLiveRow(row, index),
      );
      rows = applyQueryToMarketRows(normalizedLiveRows, {
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

  return {
    rows,
    meta: {
      search,
      sortBy,
      sortOrder,
      limit,
      total: rows.length,
      source,
      updatedAt: new Date().toISOString(),
      ...(includeDebug ? { error } : {}),
    },
  };
}
