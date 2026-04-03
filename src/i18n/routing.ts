import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uk", "en", "ru", "pl"],
  defaultLocale: "uk",
  localePrefix: "as-needed",
});
