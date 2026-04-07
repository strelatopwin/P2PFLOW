"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { useTranslations } from "next-intl";
import { useEffect, type RefObject } from "react";
import SortableColumnRow from "./sortable";
import {
  type MarketColumnKey,
  MANDATORY_MARKET_COLUMNS,
  marketColumnMessageKey,
} from "@/lib/market-table-columns";

export interface MarketColumnSettingsPopoverProps {
  open: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  columnOrder: MarketColumnKey[];
  onColumnOrderChange: (order: MarketColumnKey[]) => void;
  columnHidden: Record<MarketColumnKey, boolean>;
  onToggleColumnHidden: (key: MarketColumnKey) => void;
}

export function MarketColumnSettingsPopover({
  open,
  onClose,
  containerRef,
  columnOrder,
  onColumnOrderChange,
  columnHidden,
  onToggleColumnHidden,
}: MarketColumnSettingsPopoverProps) {
  const t = useTranslations("Market");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onClose, containerRef]);

  if (!open) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 mt-1.5 w-full max-w-none rounded-xl border border-zinc-200 bg-white py-1 shadow-md ring-1 ring-black/5 sm:left-auto sm:right-0 sm:w-[min(100vw-1.5rem,18rem)] sm:max-w-[min(100vw-1.5rem,18rem)]"
      role="dialog"
      aria-label="Column settings"
    >
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          onColumnOrderChange(
            move(
              columnOrder.map((key) => ({ id: key })),
              event,
            ).map((item) => item.id as MarketColumnKey),
          );
        }}
      >
        <ul className="max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain">
          {columnOrder.map((key, index) => (
            <SortableColumnRow
              key={key}
              id={key}
              index={index}
              label={t(marketColumnMessageKey(key))}
              showVisibilityToggle={!MANDATORY_MARKET_COLUMNS.has(key)}
              hidden={columnHidden[key]}
              onToggleHidden={() => onToggleColumnHidden(key)}
            />
          ))}
        </ul>
      </DragDropProvider>
    </div>
  );
}
