"use client";

import { useTranslations } from "next-intl";

export default function NotFoundPage() {
  const t = useTranslations("NotFound");
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <p className="text-sm text-zinc-600">{t("message")}</p>
    </main>
  );
}
