import {
  defaultMarketColumnHidden,
  defaultMarketColumnOrder,
  MARKET_COLUMN_KEYS,
  MANDATORY_MARKET_COLUMNS,
  type MarketColumnKey,
} from "@/lib/market-table-columns";

const STORAGE_KEY = "market-table-column-preferences";

const KEY_SET = new Set<string>(MARKET_COLUMN_KEYS);

function isColumnKey(value: unknown): value is MarketColumnKey {
  return typeof value === "string" && KEY_SET.has(value);
}

export function normalizeColumnOrder(raw: unknown): MarketColumnKey[] {
  if (!Array.isArray(raw)) {
    return defaultMarketColumnOrder();
  }
  const seen = new Set<MarketColumnKey>();
  const result: MarketColumnKey[] = [];
  for (const item of raw) {
    if (!isColumnKey(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  for (const key of defaultMarketColumnOrder()) {
    if (!seen.has(key)) {
      result.push(key);
    }
  }
  return result;
}

export function normalizeColumnHidden(
  raw: unknown,
): Record<MarketColumnKey, boolean> {
  const base = defaultMarketColumnHidden();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  for (const key of MARKET_COLUMN_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "boolean") {
      base[key] = v;
    }
  }
  for (const key of MANDATORY_MARKET_COLUMNS) {
    base[key] = false;
  }
  return base;
}

export type MarketColumnPreferences = {
  order: MarketColumnKey[];
  hidden: Record<MarketColumnKey, boolean>;
};

export function loadMarketColumnPreferences(): MarketColumnPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const order = normalizeColumnOrder(obj.order);
    const hidden = normalizeColumnHidden(obj.hidden);
    return { order, hidden };
  } catch {
    return null;
  }
}

export function saveMarketColumnPreferences(
  order: MarketColumnKey[],
  hidden: Record<MarketColumnKey, boolean>,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: MarketColumnPreferences = {
      order: normalizeColumnOrder(order),
      hidden: normalizeColumnHidden(hidden),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}
