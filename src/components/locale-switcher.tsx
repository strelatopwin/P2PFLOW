"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "next-intl";

const LOCALES = routing.locales;

export const toolbarSelectClassName =
  "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 shadow-sm outline-none ring-0 transition-colors focus:border-zinc-400 focus:outline-none";

type LocaleSwitcherProps = {
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
