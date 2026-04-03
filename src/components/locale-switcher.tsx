"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "next-intl";

const LOCALES = routing.locales;

/** Shared with toolbar selects (auto-refresh, etc.). */
export const toolbarSelectClassName =
  "rounded-md border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-700 outline-none ring-0 focus:border-zinc-400 md:text-sm";

type LocaleSwitcherProps = {
  /** Extra classes (e.g. `col-span-3 md:col-span-1` in a grid). */
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("LocaleSwitcher");

  return (
    <select
      aria-label={t("ariaLabel")}
      value={locale}
      onChange={(event) => {
        const next = event.target.value as Locale;
        router.replace(pathname, { locale: next });
      }}
      className={
        className
          ? `${toolbarSelectClassName} ${className}`
          : toolbarSelectClassName
      }
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {t(loc)}
        </option>
      ))}
    </select>
  );
}
