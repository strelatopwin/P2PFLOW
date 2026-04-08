import { applyQueryToMarketRows } from "@/server/market/apply-query-to-market-rows";
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

function parseCmcId(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.trunc(n);
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

function pickChainByNetwork(
  row: ProfitArbitrageRawWebDataRow,
  networkKey: string,
): ProfitArbitrageRawChain | undefined {
  const key = networkKey.trim().toLowerCase();
  if (!key || key === "unknown") {
    return undefined;
  }
  return row.chainsBuy?.find(
    (item) => (item.chain ?? "").trim().toLowerCase() === key,
  );
}

function computeProfitPercent(
  row: ProfitArbitrageRawWebDataRow,
  networkKey: string,
  profitUsd: number | null,
): number {
  const volume = asNumber(row.volumeUsd ?? row.volume);
  if (profitUsd != null && volume > 0) {
    return (profitUsd / volume) * 100;
  }
  const chain = pickChainByNetwork(row, networkKey);
  if (
    chain &&
    chain.expectedProfitIndex != null &&
    Number.isFinite(Number(chain.expectedProfitIndex))
  ) {
    return asNumber(chain.expectedProfitIndex);
  }
  return asNumber(row.profitIndexAvg);
}

function reconcileSpreadWithNetProfit(
  grossSpreadPercent: number,
  profitPercent: number,
): number {
  if (
    profitPercent !== 0 &&
    grossSpreadPercent !== 0 &&
    Math.sign(grossSpreadPercent) !== Math.sign(profitPercent) &&
    Math.abs(grossSpreadPercent) > Math.abs(profitPercent) &&
    Math.abs(grossSpreadPercent) < 2
  ) {
    return profitPercent;
  }
  return grossSpreadPercent;
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
  const buyRate =
    row.buyPriceMin != null && Number.isFinite(Number(row.buyPriceMin))
      ? asNumber(row.buyPriceMin)
      : asNumber(row.buyPriceAvg);
  const sellRate =
    row.sellPriceMax != null && Number.isFinite(Number(row.sellPriceMax))
      ? asNumber(row.sellPriceMax)
      : asNumber(row.sellPriceAvg);
  const buyExchange = titleCase(row.exchangeBuy ?? "Unknown");
  const sellExchange = titleCase(row.exchangeSell ?? "Unknown");
  const network = selectNetwork(row.chainsBuy, row.chainsSell);
  const profitUsd = pickExpectedProfitUsd(row, network);
  const profitPercent = computeProfitPercent(row, network, profitUsd);
  const grossSpreadPercent =
    buyRate > 0 ? ((buyRate - sellRate) / buyRate) * 100 : 0;
  const spreadPercent = reconcileSpreadWithNetProfit(
    grossSpreadPercent,
    profitPercent,
  );
  const cmcid = parseCmcId(row.cmcid);

  return {
    id: `${row.symbol ?? "asset"}-${buyExchange}-${sellExchange}-${index}`,
    pair,
    ...(cmcid != null ? { cmcid } : {}),
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
  const { search, sortBy, sortOrder, limit, useMockOnly } = query;

  let rows: MarketRow[] = [];
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
      source = "live";
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
      error,
    },
  };
}
