"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { apiErrorMessageFromPayload } from "@/lib/api-client-messages";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("Login");
  const tApi = useTranslations("ApiErrors");
  const tCommon = useTranslations("Common");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as {
        errorCode?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(apiErrorMessageFromPayload(payload, tApi, tApi.has));
      }

      router.push("/waiting-access");
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : tCommon("unknownError");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LocaleSwitcher />
      </div>
      <section className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mb-5 text-sm text-zinc-600">{t("description")}</p>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-700">{t("emailLabel")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {isLoading ? t("submitLoading") : t("submit")}
          </button>
        </form>
      </section>
    </main>
  );
}
