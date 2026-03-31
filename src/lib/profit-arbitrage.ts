import type { MarketRow } from "@/types/market";

const LOGIN_URL = "https://api.profitarbitrage.ai/auth/login/?scope=B2C&lang=en";
const WEBDATA_URL = "https://screener.profitarbitrage.ai/api/webdata/";
const DEFAULT_EXCHANGES =
  "binance,bybit,okex,gate,mexc,kucoin,bitget,bingx,huobi";
const DEFAULT_FID = "profitarbitrage";
const TOKEN_TTL_FALLBACK_MS = 10 * 60 * 1000;

type LoginResponse = {
  access_token?: string;
};

type RawChain = {
  chain?: string;
};

type RawWebDataRow = {
  symbol?: string;
  uniSymbol?: string;
  originalSymbol?: string;
  exchangeBuy?: string;
  exchangeSell?: string;
  buyPriceAvg?: number;
  sellPriceAvg?: number;
  volumeUsd?: number;
  volume?: number;
  profitIndexAvg?: number;
  lifetime?: number;
  chainsBuy?: RawChain[];
  chainsSell?: RawChain[];
};

type AuthCache = {
  token: string;
  expiresAtMs: number;
} | null;

let cachedAuth: AuthCache = null;

function titleCase(value: string): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { exp?: number };
    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

function selectNetwork(row: RawWebDataRow): string {
  const buyChains = new Set(
    (row.chainsBuy ?? [])
      .map((item) => (item.chain ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  for (const item of row.chainsSell ?? []) {
    const chain = (item.chain ?? "").trim().toLowerCase();
    if (chain && buyChains.has(chain)) {
      return chain.toUpperCase();
    }
  }
  const fallback = (row.chainsBuy?.[0]?.chain ?? row.chainsSell?.[0]?.chain ?? "")
    .trim()
    .toLowerCase();
  return fallback ? fallback.toUpperCase() : "UNKNOWN";
}

function normalizePair(row: RawWebDataRow): string {
  if (row.originalSymbol) {
    return row.originalSymbol.split("|")[0] ?? row.originalSymbol;
  }
  return row.uniSymbol ?? row.symbol ?? "UNKNOWN-USDT";
}

function normalizeRow(row: RawWebDataRow, index: number): MarketRow {
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
    network: selectNetwork(row),
  };
}

async function fetchAccessToken(): Promise<string> {
  const email = process.env.PROFIT_ARBITRAGE_LOGIN;
  const password = process.env.PROFIT_ARBITRAGE_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing PROFIT_ARBITRAGE_LOGIN or PROFIT_ARBITRAGE_PASSWORD");
  }

  if (cachedAuth && cachedAuth.expiresAtMs > Date.now() + 5_000) {
    return cachedAuth.token;
  }

  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Login failed with ${response.status}`);
  }

  const payload = (await response.json()) as LoginResponse;
  if (!payload.access_token) {
    throw new Error("Login response did not contain access_token");
  }

  const expiryFromJwt = decodeJwtExp(payload.access_token);
  cachedAuth = {
    token: payload.access_token,
    expiresAtMs: expiryFromJwt ?? Date.now() + TOKEN_TTL_FALLBACK_MS,
  };
  return cachedAuth.token;
}

function makeWebDataParams(limit: number): URLSearchParams {
  const buyExchanges =
    process.env.PROFIT_ARBITRAGE_BUY_EXCHANGES ?? DEFAULT_EXCHANGES;
  const sellExchanges =
    process.env.PROFIT_ARBITRAGE_SELL_EXCHANGES ?? DEFAULT_EXCHANGES;
  const fid = process.env.PROFIT_ARBITRAGE_FID ?? DEFAULT_FID;

  return new URLSearchParams({
    buy_exchanges: buyExchanges,
    sell_exchanges: sellExchanges,
    fid,
    lang: "en",
    limit: String(limit),
  });
}

export async function getLiveMarketRows(limit: number): Promise<MarketRow[]> {
  const token = await fetchAccessToken();
  const params = makeWebDataParams(limit);
  const response = await fetch(`${WEBDATA_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Webdata request failed with ${response.status}`);
  }

  const payload = (await response.json()) as RawWebDataRow[];
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected webdata response format");
  }

  return payload.map((row, index) => normalizeRow(row, index));
}
