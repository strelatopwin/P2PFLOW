"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  LocaleSwitcher,
  toolbarSelectClassName,
} from "@/components/locale-switcher";
import { apiErrorMessageFromPayload } from "@/lib/api-client-messages";
import type { MarketRow, SortBy, SortOrder } from "@/types/market";
import { MarketColumnSettingsPopover } from "@/components/drag-and-drop/column-settings-popover";
import {
  loadMarketColumnPreferences,
  saveMarketColumnPreferences,
} from "@/lib/market-table-columns-storage";
import {
  defaultMarketColumnHidden,
  defaultMarketColumnOrder,
  isMarketSortColumn,
  type MarketColumnKey,
  marketColumnMessageKey,
  MANDATORY_MARKET_COLUMNS,
} from "@/lib/market-table-columns";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";
import Image from "next/image";

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

const AUTO_REFRESH_VALUES = [0, 5, 10, 15, 30] as const;
const COIN_ICON_BASE = "https://s3.arbitragescanner.io/w/coin";

const toolbarButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-800 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

const tableHeaderCell =
  "border-b border-zinc-200 bg-zinc-50 px-3 py-3.5 text-center text-[13px] font-semibold leading-tight text-zinc-600 break-words";

const tableBodyCellBase =
  "border-b border-zinc-100 px-3 py-3.5 text-center align-middle text-sm leading-snug break-words";

const tableBodyCell = `${tableBodyCellBase} text-zinc-800`;

const spreadTagBase =
  "mx-auto inline-flex w-max max-w-full items-center gap-1 rounded-2xl px-3 py-1 text-xs font-medium leading-4 tabular-nums transition-[color,background-color] duration-200";

function formatVolumeUsd(value: number, locale: string): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M USD`;
  }
  return `${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
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
    return <span className="text-zinc-500">UNKNOWN</span>;
  }
  return (
    <>
      {entries.map((entry, index) => (
        <span key={index}>
          {index > 0 ? ", " : null}
          <span
            className={
              entry.expectedProfitIndex >= 0
                ? "font-medium text-green-600"
                : "font-medium text-red-600"
            }
          >
            {entry.text}
          </span>
        </span>
      ))}
    </>
  );
}

function pairInitial(pair: string): string {
  const base = pair.split("-")[0]?.trim() || pair;
  const ch = base.charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function PairWithLogo({ row }: { row: MarketRow }) {
  const cmcid = row.cmcid;
  const hasIconId = cmcid != null && cmcid > 0;
  const [imgFailed, setImgFailed] = useState(false);

  const showImage = hasIconId && !imgFailed;
  const initial = pairInitial(row.pair);

  return (
    <div className="inline-flex max-w-full items-center gap-2 whitespace-nowrap">
      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-zinc-200">
        {showImage ? (
          <Image
            src={`${COIN_ICON_BASE}/${cmcid}.png`}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            onError={() => setImgFailed(true)}
            width={24}
            height={24}
          />
        ) : null}
        {!showImage ? (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-zinc-600">
            {initial}
          </span>
        ) : null}
      </div>
      <span className="min-w-0">{row.pair}</span>
    </div>
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
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<MarketColumnKey[]>(
    defaultMarketColumnOrder,
  );
  const [columnHidden, setColumnHidden] = useState<
    Record<MarketColumnKey, boolean>
  >(defaultMarketColumnHidden);

  const columnSettingsRef = useRef<HTMLDivElement>(null);
  const skipNextColumnPrefsPersist = useRef(true);

  useEffect(() => {
    const saved = loadMarketColumnPreferences();
    if (saved) {
      setColumnOrder(saved.order);
      setColumnHidden(saved.hidden);
    }
  }, []);

  useEffect(() => {
    if (skipNextColumnPrefsPersist.current) {
      skipNextColumnPrefsPersist.current = false;
      return;
    }
    saveMarketColumnPreferences(columnOrder, columnHidden);
  }, [columnOrder, columnHidden]);

  const visibleOrderedColumns = useMemo(
    () =>
      columnOrder.filter(
        (key) => MANDATORY_MARKET_COLUMNS.has(key) || !columnHidden[key],
      ),
    [columnOrder, columnHidden],
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
    [t],
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
        } catch {}

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
          const upstreamRaw = data.meta?.error;
          const upstreamMsg =
            typeof upstreamRaw === "string" ? upstreamRaw.trim() : "";
          if (upstreamMsg.length > 0) {
            setError(`${t("loadErrorPrefix")} ${upstreamMsg}`);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function toggleColumnHidden(key: MarketColumnKey): void {
    if (MANDATORY_MARKET_COLUMNS.has(key)) return;
    setColumnHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderColumnHeader(key: MarketColumnKey) {
    const label = t(marketColumnMessageKey(key));

    if (isMarketSortColumn(key)) {
      const isActive = sortBy === key;
      return (
        <th key={key} className={tableHeaderCell}>
          <button
            type="button"
            onClick={() => toggleSort(key)}
            className="inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-md text-inherit hover:text-zinc-900"
          >
            <span className="min-w-0">{label}</span>
            {isActive ? (
              sortOrder === "asc" ? (
                <ChevronUp
                  className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                  aria-hidden
                />
              ) : (
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 text-zinc-500"
                  aria-hidden
                />
              )
            ) : null}
          </button>
        </th>
      );
    }

    return (
      <th key={key} className={tableHeaderCell}>
        {label}
      </th>
    );
  }

  function renderColumnCell(row: MarketRow, key: MarketColumnKey) {
    switch (key) {
      case "pair":
        return (
          <td
            key={key}
            className={`${tableBodyCell} font-semibold text-zinc-950 tabular-nums whitespace-nowrap`}
          >
            <PairWithLogo key={`${row.id}-${row.cmcid ?? ""}`} row={row} />
          </td>
        );
      case "buyRate":
        return (
          <td
            key={key}
            className={`${tableBodyCell} tabular-nums text-zinc-800`}
          >
            {formatRate(row.buyRate)}
          </td>
        );
      case "sellRate":
        return (
          <td
            key={key}
            className={`${tableBodyCell} tabular-nums text-zinc-800`}
          >
            {formatRate(row.sellRate)}
          </td>
        );
      case "volume24hUsd":
        return (
          <td
            key={key}
            className={`${tableBodyCell} tabular-nums text-zinc-800`}
          >
            {formatVolumeUsd(row.volume24hUsd, locale)}
          </td>
        );
      case "profitPercent":
        return (
          <td
            key={key}
            className={`${tableBodyCellBase} font-medium tabular-nums ${
              row.profitPercent >= 0
                ? "text-(--color-green)"
                : "text-(--color-red)"
            }`}
          >
            {row.profitDisplay}
          </td>
        );
      case "spreadPercent":
        return (
          <td key={key} className={tableBodyCell}>
            <div dir="ltr" className="flex justify-center">
              <span
                className={`${spreadTagBase} ${
                  row.spreadPercent >= 0
                    ? "bg-(--color-green-bg) text-(--color-green)"
                    : "bg-(--color-red-bg) text-(--color-red)"
                }`}
              >
                {formatPercent(row.spreadPercent)}
              </span>
            </div>
          </td>
        );
      case "lifetimeMs":
        return (
          <td key={key} className={`${tableBodyCell} text-zinc-800`}>
            {formatLifetime(row.lifetimeMs)}
          </td>
        );
      case "buyExchange":
        return (
          <td key={key} className={`${tableBodyCell} text-zinc-800`}>
            {row.buyExchange}
          </td>
        );
      case "sellExchange":
        return (
          <td key={key} className={`${tableBodyCell} text-zinc-800`}>
            {row.sellExchange}
          </td>
        );
      case "withdrawalNetwork":
        return (
          <td key={key} className={`${tableBodyCell} text-zinc-800`}>
            <WithdrawalNetworksCell entries={row.withdrawalNetworkEntries} />
          </td>
        );
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }

  const toolbarSelectLayout = "w-full shrink-0 sm:w-auto sm:min-w-[9rem]";

  return (
    <main className="min-h-screen p-3 md:p-6">
      <section className="mx-auto w-full min-w-0 max-w-7xl rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm md:p-6">
        <div className="mb-5 flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <h1 className="shrink-0 text-2xl font-bold tracking-tight text-zinc-950">
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
              className="h-9 min-w-0 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 sm:min-w-[10rem] sm:flex-1 sm:basis-[12rem] md:max-w-md"
            />
            <div
              ref={columnSettingsRef}
              className="relative w-full sm:w-auto sm:shrink-0"
            >
              <div className="flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => setRefreshKey((current) => current + 1)}
                  className={`${toolbarButtonClass} flex-1 bg-zinc-50 hover:bg-zinc-100 sm:flex-none sm:px-4`}
                >
                  {isRefreshing ? t("refreshing") : t("refresh")}
                </button>
                <button
                  type="button"
                  onClick={() => setColumnSettingsOpen((open) => !open)}
                  aria-expanded={columnSettingsOpen}
                  aria-haspopup="dialog"
                  className={`${toolbarButtonClass} flex-1 bg-white hover:bg-zinc-50 sm:flex-none sm:w-9 sm:px-0`}
                >
                  <Settings
                    className="h-[18px] w-[18px] text-zinc-700"
                    strokeWidth={1.75}
                  />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className={`${toolbarButtonClass} flex-1 bg-white hover:bg-zinc-50 sm:flex-none sm:px-4`}
                >
                  {t("logout")}
                </button>
              </div>
              <MarketColumnSettingsPopover
                open={columnSettingsOpen}
                onClose={() => setColumnSettingsOpen(false)}
                containerRef={columnSettingsRef}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
                columnHidden={columnHidden}
                onToggleColumnHidden={toggleColumnHidden}
              />
            </div>
          </div>
        </div>

        <div className="mb-4 text-xs leading-relaxed text-zinc-500">
          {updatedAt
            ? t("lastUpdated", {
                time: new Date(updatedAt).toLocaleString(locale),
                source: formatDataSource(dataSource),
              })
            : ""}
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600"
          >
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="py-8 text-sm text-zinc-500">{t("loading")}</div>
        ) : null}

        {!isLoading ? (
          <>
            <div className="space-y-3 md:hidden">
              {rows.length === 0 ? (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-500">
                  {t("empty")}
                </div>
              ) : null}
              {rows.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-zinc-950">
                      <PairWithLogo
                        key={`${row.id}-${row.cmcid ?? ""}`}
                        row={row}
                      />
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        row.profitPercent >= 0
                          ? "text-(--color-green)"
                          : "text-(--color-red)"
                      }`}
                    >
                      {row.profitDisplay}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs leading-relaxed text-zinc-600">
                    <span>
                      {t("mobileBuy")} {formatRate(row.buyRate)}
                    </span>
                    <span>
                      {t("mobileSell")} {formatRate(row.sellRate)}
                    </span>
                    <span>
                      {t("mobileVolume")}{" "}
                      {formatVolumeUsd(row.volume24hUsd, locale)}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0">{t("mobileSpread")}</span>
                      <span
                        dir="ltr"
                        className={`${spreadTagBase} ${
                          row.spreadPercent >= 0
                            ? "bg-(--color-green-bg) text-(--color-green)"
                            : "bg-(--color-red-bg) text-(--color-red)"
                        }`}
                      >
                        {formatPercent(row.spreadPercent)}
                      </span>
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

            <div className="hidden overflow-x-auto rounded-xl border border-zinc-100 md:block">
              <table className="w-max min-w-full border-collapse">
                <thead>
                  <tr>
                    {visibleOrderedColumns.map((key) =>
                      renderColumnHeader(key),
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(visibleOrderedColumns.length, 1)}
                        className="px-4 py-12 text-center text-sm text-zinc-500"
                      >
                        {t("empty")}
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-zinc-50/80"
                    >
                      {visibleOrderedColumns.map((key) =>
                        renderColumnCell(row, key),
                      )}
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
