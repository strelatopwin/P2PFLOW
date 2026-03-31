import type {
  ProfitArbitrageAuthCache,
  ProfitArbitrageLoginResponse,
  ProfitArbitrageRawWebDataRow,
} from "@/server/profit-arbitrage-client/profit-arbitrage-client.types";
import {
  PROFIT_ARBITRAGE_DEFAULT_EXCHANGES,
  PROFIT_ARBITRAGE_DEFAULT_FID,
  PROFIT_ARBITRAGE_LOGIN_URL,
  PROFIT_ARBITRAGE_MIN_REQUEST_INTERVAL_MS_DEFAULT,
  PROFIT_ARBITRAGE_TOKEN_TTL_FALLBACK_MS,
  PROFIT_ARBITRAGE_WEBDATA_URL,
} from "@/server/profit-arbitrage-client/profit-arbitrage-client.constants";
import { decodeJwtExp } from "@/server/profit-arbitrage-client/profit-arbitrage-client.utils";

let cachedAuth: ProfitArbitrageAuthCache = null;
let webDataCache:
  | {
      key: string;
      expiresAtMs: number;
      payload: ProfitArbitrageRawWebDataRow[];
    }
  | null = null;
let webDataInFlight:
  | {
      key: string;
      promise: Promise<ProfitArbitrageRawWebDataRow[]>;
    }
  | null = null;

function getMinRequestIntervalMs(): number {
  const fromEnv = Number(process.env.PROFIT_ARBITRAGE_MIN_REQUEST_INTERVAL_MS);
  if (Number.isFinite(fromEnv) && fromEnv >= 1000) {
    return Math.floor(fromEnv);
  }
  return PROFIT_ARBITRAGE_MIN_REQUEST_INTERVAL_MS_DEFAULT;
}

async function fetchAccessToken(): Promise<string> {
  const email = process.env.PROFIT_ARBITRAGE_LOGIN;
  const password = process.env.PROFIT_ARBITRAGE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing PROFIT_ARBITRAGE_LOGIN or PROFIT_ARBITRAGE_PASSWORD",
    );
  }

  if (cachedAuth && cachedAuth.expiresAtMs > Date.now() + 5_000) {
    return cachedAuth.token;
  }

  const response = await fetch(PROFIT_ARBITRAGE_LOGIN_URL, {
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

  const payload = (await response.json()) as ProfitArbitrageLoginResponse;
  if (!payload.access_token) {
    throw new Error("Login response did not contain access_token");
  }

  const expiryFromJwt = decodeJwtExp(payload.access_token);
  cachedAuth = {
    token: payload.access_token,
    expiresAtMs:
      expiryFromJwt ?? Date.now() + PROFIT_ARBITRAGE_TOKEN_TTL_FALLBACK_MS,
  };
  return cachedAuth.token;
}

function makeWebDataParams(limit: number): URLSearchParams {
  const buyExchanges =
    process.env.PROFIT_ARBITRAGE_BUY_EXCHANGES ??
    PROFIT_ARBITRAGE_DEFAULT_EXCHANGES;
  const sellExchanges =
    process.env.PROFIT_ARBITRAGE_SELL_EXCHANGES ??
    PROFIT_ARBITRAGE_DEFAULT_EXCHANGES;
  const fid = process.env.PROFIT_ARBITRAGE_FID ?? PROFIT_ARBITRAGE_DEFAULT_FID;

  return new URLSearchParams({
    buy_exchanges: buyExchanges,
    sell_exchanges: sellExchanges,
    fid,
    lang: "en",
    limit: String(limit),
  });
}

export async function fetchProfitArbitrageWebData(
  limit: number,
): Promise<ProfitArbitrageRawWebDataRow[]> {
  const token = await fetchAccessToken();
  const params = makeWebDataParams(limit);
  const cacheKey = params.toString();
  const now = Date.now();

  if (webDataCache && webDataCache.key === cacheKey && webDataCache.expiresAtMs > now) {
    return webDataCache.payload;
  }

  if (webDataInFlight && webDataInFlight.key === cacheKey) {
    return webDataInFlight.promise;
  }

  const requestPromise = (async () => {
    const response = await fetch(
      `${PROFIT_ARBITRAGE_WEBDATA_URL}?${cacheKey}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Webdata request failed with ${response.status}`);
    }

    const payload = (await response.json()) as ProfitArbitrageRawWebDataRow[];
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected webdata response format");
    }

    webDataCache = {
      key: cacheKey,
      payload,
      expiresAtMs: Date.now() + getMinRequestIntervalMs(),
    };
    return payload;
  })();

  webDataInFlight = {
    key: cacheKey,
    promise: requestPromise,
  };

  try {
    return await requestPromise;
  } finally {
    if (webDataInFlight?.promise === requestPromise) {
      webDataInFlight = null;
    }
  }
}
