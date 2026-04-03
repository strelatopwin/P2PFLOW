"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  LocaleSwitcher,
  toolbarSelectClassName,
} from "@/components/locale-switcher";
import { apiErrorMessageFromPayload } from "@/lib/api-client-messages";
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

const SORT_KEYS: SortBy[] = [
  "pair",
  "buyRate",
  "sellRate",
  "volume24hUsd",
  "profitPercent",
  "spreadPercent",
  "lifetimeMs",
];

const AUTO_REFRESH_VALUES = [0, 5, 10, 15, 30] as const;

function formatUsd(value: number, locale: string): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat(locale, {
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
  const locale = useLocale();
  const t = useTranslations("Market");
  const tApi = useTranslations("ApiErrors");
  const tCommon = useTranslations("Common");

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

  const sortableColumns = useMemo(
    () =>
      SORT_KEYS.map((key) => ({
        key,
        label: t(`columns.${key}`),
      })),
    [t]
  );

  const autoRefreshOptions = useMemo(
    () =>
      AUTO_REFRESH_VALUES.map((value) => ({
        value,
        label:
          value === 0
            ? t("autoRefresh.off")
            : value === 5
              ? t("autoRefresh.sec5")
              : value === 10
                ? t("autoRefresh.sec10")
                : value === 15
                  ? t("autoRefresh.sec15")
                  : t("autoRefresh.sec30"),
      })),
    [t]
  );

  function formatLifetime(ms: number): string {
    if (ms <= 0) {
      return t("lifetimeZero");
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return t("lifetime", { minutes, seconds });
  }

  function formatDataSource(source: "live" | "mock"): string {
    return source === "live" ? t("dataSourceLive") : t("dataSourceMock");
  }

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
        let payload: {
          errorCode?: string;
          error?: string;
          rows?: MarketRow[];
          meta?: ApiResponse["meta"];
        } = {};

        try {
          payload = await response.json();
        } catch {
          /* non-JSON */
        }

        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (response.status === 403) {
          router.push("/waiting-access");
          return;
        }
        if (!response.ok) {
          const msg = apiErrorMessageFromPayload(payload, tApi, tApi.has);
          throw new Error(msg);
        }

        const data = payload as ApiResponse;
        if (!ignore) {
          setRows(data.rows ?? []);
          setUpdatedAt(data.meta?.updatedAt ?? "");
          setDataSource(data.meta?.source ?? "mock");
        }
      } catch (caught) {
        if (!ignore && !controller.signal.aborted) {
          const message =
            caught instanceof Error ? caught.message : tCommon("unknownError");
          setError(`${t("loadErrorPrefix")} ${message}`);
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
    // Intentionally omit next-intl `t`/`tApi`/`tCommon` to avoid refetch loops on locale (tree remounts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, refreshKey, router]);

  useEffect(() => {
    if (autoRefreshSeconds <= 0) {
      return;
    }

    const jitterFactor = 0.85 + Math.random() * 0.3;
    const delayMs = Math.max(
      3000,
      Math.round(autoRefreshSeconds * 1000 * jitterFactor)
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

  const toolbarSelectLayout =
    "w-full shrink-0 sm:w-auto sm:min-w-[9rem]";

  return (
    <main className="min-h-screen p-3 md:p-6">
      <section className="mx-auto w-full min-w-0 max-w-7xl rounded-xl bg-white p-3 shadow-sm md:p-5">
        <div className="mb-4 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <h1 className="shrink-0 text-xl font-semibold text-zinc-900">
            {t("title")}
          </h1>
          <div className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <LocaleSwitcher className={toolbarSelectLayout} />
            <select
              value={String(autoRefreshSeconds)}
              onChange={(event) => {
                setAutoRefreshSeconds(Number(event.target.value));
              }}
              className={`${toolbarSelectClassName} ${toolbarSelectLayout}`}
            >
              {autoRefreshOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none ring-0 focus:border-zinc-400 sm:min-w-[10rem] sm:flex-1 sm:basis-[12rem] md:max-w-md"
            />
            <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100 sm:flex-none md:text-sm"
              >
                {isRefreshing ? t("refreshing") : t("refresh")}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 sm:flex-none md:text-sm"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 text-xs text-zinc-500">
          {updatedAt
            ? t("lastUpdated", {
                time: new Date(updatedAt).toLocaleString(locale),
                source: formatDataSource(dataSource),
              })
            : ""}
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {!error && isLoading ? (
          <div className="py-8 text-sm text-zinc-500">{t("loading")}</div>
        ) : null}

        {!error && !isLoading ? (
          <>
            <div className="space-y-2 md:hidden">
              {rows.length === 0 ? (
                <div className="rounded-md border border-zinc-100 px-3 py-6 text-center text-sm text-zinc-500">
                  {t("empty")}
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
                    <span>
                      {t("mobileBuy")} {formatRate(row.buyRate)}
                    </span>
                    <span>
                      {t("mobileSell")} {formatRate(row.sellRate)}
                    </span>
                    <span>
                      {t("mobileVolume")}{" "}
                      {formatUsd(row.volume24hUsd, locale)}
                    </span>
                    <span>
                      {t("mobileSpread")} {formatPercent(row.spreadPercent)}
                    </span>
                    <span>
                      {t("mobileBuyExchange")} {row.buyExchange}
                    </span>
                    <span>
                      {t("mobileSellExchange")} {row.sellExchange}
                    </span>
                    <span className="col-span-2 text-zinc-600">
                      {t("mobileNetwork")}{" "}
                      <WithdrawalNetworksCell
                        entries={row.withdrawalNetworkEntries}
                      />
                    </span>
                    <span>
                      {t("mobileLifetime")} {formatLifetime(row.lifetimeMs)}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    {sortableColumns.map((column) => {
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
                    <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium tracking-wide text-zinc-600">
                      {t("thBuyExchange")}
                    </th>
                    <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium tracking-wide text-zinc-600">
                      {t("thSellExchange")}
                    </th>
                    <th className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-xs font-medium tracking-wide text-zinc-600">
                      {t("thNetwork")}
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
                        {t("empty")}
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
                        {formatUsd(row.volume24hUsd, locale)}
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
