"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketRow, SortBy, SortOrder } from "@/types/market";

type ApiResponse = {
  rows: MarketRow[];
  meta: {
    search: string;
    sortBy: SortBy;
    sortOrder: SortOrder;
    limit: number;
    total: number;
    source?: "live" | "mock";
    error?: string | null;
    updatedAt: string;
  };
};

const SORTABLE_COLUMNS: Array<{ label: string; key: SortBy }> = [
  { label: "Currency pair", key: "pair" },
  { label: "Buy rate", key: "buyRate" },
  { label: "Sell rate", key: "sellRate" },
  { label: "Volume", key: "volume24hUsd" },
  { label: "Profit", key: "profitPercent" },
  { label: "Spread", key: "spreadPercent" },
  { label: "Lifetime", key: "lifetimeMs" },
];

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value: number): string {
  if (value < 0.01) {
    return value.toFixed(8);
  }
  return value.toFixed(4);
}

function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatLifetime(ms: number): string {
  if (ms <= 0) {
    return "0ms";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export default function Home() {
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("profitPercent");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [dataSource, setDataSource] = useState<"live" | "mock">("mock");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      search,
      sortBy,
      sortOrder,
      limit: "100",
    });
    return `/api/market?${params.toString()}`;
  }, [search, sortBy, sortOrder]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    async function loadData() {
      setError("");
      setIsRefreshing(true);
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload: ApiResponse = await response.json();
        if (!ignore) {
          setRows(payload.rows);
          setUpdatedAt(payload.meta.updatedAt);
          setDataSource(payload.meta.source ?? "mock");
        }
      } catch (caught) {
        if (!ignore && !controller.signal.aborted) {
          const message =
            caught instanceof Error ? caught.message : "Unknown error";
          setError(`Cannot load market data: ${message}`);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [endpoint, refreshKey]);

  function toggleSort(column: SortBy): void {
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder("desc");
  }

  return (
    <main className="min-h-screen p-6">
      <section className="mx-auto w-full max-w-7xl rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">
            Arbitrage Screener
          </h1>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pair, exchange, network"
              className="w-72 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none ring-0 focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mb-3 text-xs text-zinc-500">
          {updatedAt
            ? `Last update: ${new Date(updatedAt).toLocaleString()} (${dataSource})`
            : ""}
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {!error && isLoading ? (
          <div className="py-8 text-sm text-zinc-500">Loading market data...</div>
        ) : null}

        {!error && !isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map((column) => {
                    const isActive = sortBy === column.key;
                    return (
                      <th
                        key={column.key}
                        className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1"
                        >
                          {column.label}
                          {isActive ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                        </button>
                      </th>
                    );
                  })}
                  <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                    Buy exchange
                  </th>
                  <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                    Sell exchange
                  </th>
                  <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                    Network
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-sm text-zinc-500"
                    >
                      No rows found for the current filter.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm font-medium text-zinc-900">
                      {row.pair}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {formatRate(row.buyRate)}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {formatRate(row.sellRate)}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {formatUsd(row.volume24hUsd)}
                    </td>
                    <td
                      className={`border-b border-zinc-100 px-3 py-3 text-sm ${
                        row.profitPercent >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatPercent(row.profitPercent)}
                    </td>
                    <td
                      className={`border-b border-zinc-100 px-3 py-3 text-sm ${
                        row.spreadPercent >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatPercent(row.spreadPercent)}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {formatLifetime(row.lifetimeMs)}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {row.buyExchange}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {row.sellExchange}
                    </td>
                    <td className="border-b border-zinc-100 px-3 py-3 text-sm text-zinc-700">
                      {row.network}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
