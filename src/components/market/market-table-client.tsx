"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const AUTO_REFRESH_OPTIONS = [
  { value: 0, label: "Не оновлювати" },
  { value: 5, label: "Кожні 5 с" },
  { value: 10, label: "Кожні 10 с" },
  { value: 15, label: "Кожні 15 с" },
  { value: 30, label: "Кожні 30 с" },
];

const SORTABLE_COLUMNS: Array<{ label: string; key: SortBy }> = [
  { label: "Валютна пара", key: "pair" },
  { label: "Курс купівлі", key: "buyRate" },
  { label: "Курс продажу", key: "sellRate" },
  { label: "Обʼєм", key: "volume24hUsd" },
  { label: "Профіт", key: "profitPercent" },
  { label: "Спред", key: "spreadPercent" },
  { label: "Тривалість", key: "lifetimeMs" },
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
  return `${minutes}хв ${seconds}с`;
}

function formatDataSource(source: "live" | "mock"): string {
  return source === "live" ? "реальні дані" : "тестові дані";
}

function WithdrawalNetworksCell({
  entries,
}: {
  entries: MarketRow["withdrawalNetworkEntries"];
}) {
  if (entries.length === 0) {
    return <span className="text-zinc-700">UNKNOWN</span>;
  }
  return (
    <>
      {entries.map((entry, index) => (
        <span key={index}>
          {index > 0 ? ", " : null}
          <span
            className={
              entry.expectedProfitIndex >= 0
                ? "text-emerald-600"
                : "text-rose-600"
            }
          >
            {entry.text}
          </span>
        </span>
      ))}
    </>
  );
}

export function MarketTableClient() {
  const router = useRouter();
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
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(0);

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
        if (response.status === 401 || response.status === 403) {
          router.push("/waiting-access");
          return;
        }
        if (!response.ok) {
          throw new Error(`Помилка запиту: ${response.status}`);
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
            caught instanceof Error ? caught.message : "Невідома помилка";
          setError(`Не вдалося завантажити ринкові дані: ${message}`);
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
  }, [endpoint, refreshKey, router]);

  useEffect(() => {
    if (autoRefreshSeconds <= 0) {
      return;
    }

    const jitterFactor = 0.85 + Math.random() * 0.3;
    const delayMs = Math.max(
      3000,
      Math.round(autoRefreshSeconds * 1000 * jitterFactor),
    );

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (isRefreshing) {
        return;
      }
      setRefreshKey((current) => current + 1);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoRefreshSeconds, refreshKey, isRefreshing]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleSort(column: SortBy): void {
    if (sortBy === column) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder("desc");
  }

  return (
    <main className="min-h-screen p-3 md:p-6">
      <section className="mx-auto w-full max-w-7xl rounded-xl bg-white p-3 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">
            Арбітражний скрінер
          </h1>
          <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:items-center">
            <select
              value={String(autoRefreshSeconds)}
              onChange={(event) => {
                setAutoRefreshSeconds(Number(event.target.value));
              }}
              className="col-span-3 rounded-md border border-zinc-200 px-2 py-2 text-xs text-zinc-700 outline-none ring-0 focus:border-zinc-400 md:col-span-1 md:text-sm"
            >
              {AUTO_REFRESH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук пари, біржі, мережі"
              className="col-span-3 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none ring-0 focus:border-zinc-400 md:col-span-1 md:w-72"
            />
            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 md:text-sm"
            >
              {isRefreshing ? "Оновлення..." : "Оновити"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 md:text-sm"
            >
              Вийти
            </button>
          </div>
        </div>

        <div className="mb-3 text-xs text-zinc-500">
          {updatedAt
            ? `Останнє оновлення: ${new Date(updatedAt).toLocaleString()} (${formatDataSource(dataSource)})`
            : ""}
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {!error && isLoading ? (
          <div className="py-8 text-sm text-zinc-500">
            Завантаження ринкових даних...
          </div>
        ) : null}

        {!error && !isLoading ? (
          <>
            <div className="space-y-2 md:hidden">
              {rows.length === 0 ? (
                <div className="rounded-md border border-zinc-100 px-3 py-6 text-center text-sm text-zinc-500">
                  За поточними фільтрами нічого не знайдено.
                </div>
              ) : null}
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-lg border border-zinc-100 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-zinc-900">
                      {row.pair}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        row.profitPercent >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {row.profitDisplay}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600">
                    <span>Купівля: {formatRate(row.buyRate)}</span>
                    <span>Продаж: {formatRate(row.sellRate)}</span>
                    <span>Обʼєм: {formatUsd(row.volume24hUsd)}</span>
                    <span>Спред: {formatPercent(row.spreadPercent)}</span>
                    <span>Біржа куп.: {row.buyExchange}</span>
                    <span>Біржа прод.: {row.sellExchange}</span>
                    <span className="col-span-2 text-zinc-600">
                      Мережа виводу:
                      <WithdrawalNetworksCell
                        entries={row.withdrawalNetworkEntries}
                      />
                    </span>
                    <span>Тривалість: {formatLifetime(row.lifetimeMs)}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0">
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
                      Біржа купівлі
                    </th>
                    <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                      Біржа продажу
                    </th>
                    <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
                      Мережа виводу
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
                        За поточними фільтрами нічого не знайдено.
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
                          row.profitPercent >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {row.profitDisplay}
                      </td>
                      <td
                        className={`border-b border-zinc-100 px-3 py-3 text-sm ${
                          row.spreadPercent >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
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
                      <td className="border-b border-zinc-100 px-3 py-3 text-sm">
                        <WithdrawalNetworksCell
                          entries={row.withdrawalNetworkEntries}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
