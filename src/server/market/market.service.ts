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

function formatWithdrawalFeeUsd(feeUsd: unknown): string | null {
  const n = Number(feeUsd);
  if (!Number.isFinite(n)) {
    return null;
  }
  const decimals = Math.abs(n) >= 1 ? 2 : 4;
  const fixed = n.toFixed(decimals);
  const trimmed = fixed
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
  return `$${trimmed}`;
}

function formatTransferTimeMinutes(
  minRaw: unknown,
  maxRaw: unknown,
): string | null {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  const hasMin = Number.isFinite(min) && min >= 0;
  const hasMax = Number.isFinite(max) && max >= 0;
  if (!hasMin && !hasMax) {
    return null;
  }
  if (hasMin && hasMax) {
    if (min === max) {
      return `~${min}хв.`;
    }
    return `${min}хв. ~ ${max}хв.`;
  }
  if (hasMin) {
    return `~${min}хв.`;
  }
  return `~${max}хв.`;
}

function formatWithdrawalChainEntry(
  item: ProfitArbitrageRawChain,
): string | null {
  const name = (item.chain ?? "").trim().toUpperCase();
  if (!name) {
    return null;
  }
  if (item.withdrawEnabled === false) {
    return null;
  }
  const feeStr = formatWithdrawalFeeUsd(item.withdrawFeeUsd);
  const timeStr = formatTransferTimeMinutes(
    item.minTransferTimeMinutes,
    item.maxTransferTimeMinutes,
  );
  const inner = [feeStr, timeStr].filter(Boolean).join(", ");
  if (!inner) {
    return name;
  }
  return `${name} ( ${inner} )`;
}

function formatProfitUsdAmount(value: number): string {
  const abs = Math.abs(value);
  const decimals = abs >= 1 ? 2 : 3;
  let s = abs.toFixed(decimals);
  s = s.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
  return s;
}

function pickExpectedProfitUsd(
  row: ProfitArbitrageRawWebDataRow,
  networkKey: string,
): number | null {
  const key = networkKey.trim().toLowerCase();
  if (key && key !== "unknown") {
    const match = row.chainsBuy?.find(
      (item) => (item.chain ?? "").trim().toLowerCase() === key,
    );
    if (
      match &&
      match.expectedProfitUsd != null &&
      Number.isFinite(Number(match.expectedProfitUsd))
    ) {
      return asNumber(match.expectedProfitUsd);
    }
  }
  if (
    row.expectedProfitUsd != null &&
    Number.isFinite(Number(row.expectedProfitUsd))
  ) {
    return asNumber(row.expectedProfitUsd);
  }
  return null;
}

function formatProfitDisplay(
  percentValue: number,
  usd: number | null,
  networkKey: string,
): string {
  const pct = `${percentValue.toFixed(2)}%`;
  const net = (networkKey || "UNKNOWN").trim();
  if (usd == null) {
    return `${pct} (${net})`;
  }
  const absPart = formatProfitUsdAmount(usd);
  const dollarCore = usd < 0 ? `-$${absPart}` : `$${absPart}`;
  return `${pct} (${dollarCore}, ${net})`;
}

function buildWithdrawalNetworkEntries(
  row: ProfitArbitrageRawWebDataRow,
): Array<{ text: string; expectedProfitIndex: number }> {
  const fallbackProfit = asNumber(row.profitIndexAvg);
  const entries = (row.chainsBuy ?? [])
    .map((item) => {
      const text = formatWithdrawalChainEntry(item);
      if (!text) {
        return null;
      }
      const hasOwn =
        item.expectedProfitIndex != null &&
        Number.isFinite(Number(item.expectedProfitIndex));
      const expectedProfitIndex = hasOwn
        ? asNumber(item.expectedProfitIndex)
        : fallbackProfit;
      return { text, expectedProfitIndex };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);
  return entries;
}

function normalizePair(row: ProfitArbitrageRawWebDataRow): string {
  if (row.exchangeBuySymbol) {
    return row.exchangeBuySymbol;
  }
  if (row.originalSymbol) {
    return row.originalSymbol.split("|")[0] ?? row.originalSymbol;
  }
  if (row.exchangeSellSymbol) {
    return row.exchangeSellSymbol;
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
  const network = selectNetwork(row.chainsBuy, row.chainsSell);
  const profitPercent = asNumber(row.exitProfitIndex ?? row.profitIndexAvg);
  const profitUsd = pickExpectedProfitUsd(row, network);

  return {
    id: `${row.symbol ?? "asset"}-${buyExchange}-${sellExchange}-${index}`,
    pair,
    buyExchange,
    sellExchange,
    buyRate,
    sellRate,
    volume24hUsd: asNumber(row.volumeUsd ?? row.volume),
    profitPercent,
    profitDisplay: formatProfitDisplay(profitPercent, profitUsd, network),
    spreadPercent,
    lifetimeMs: asNumber(row.lifetime),
    network,
    withdrawalNetworkEntries: buildWithdrawalNetworkEntries(row),
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
