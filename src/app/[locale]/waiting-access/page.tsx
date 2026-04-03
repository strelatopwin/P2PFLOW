"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { apiErrorMessageFromPayload } from "@/lib/api-client-messages";

type AccessStatusResponse = {
  status: "pending" | "approved";
  approved: boolean;
};

export default function WaitingAccessPage() {
  const router = useRouter();
  const t = useTranslations("WaitingAccess");
  const tApi = useTranslations("ApiErrors");
  const tCommon = useTranslations("Common");
  const [status, setStatus] = useState<AccessStatusResponse["status"]>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;

    async function checkStatus() {
      try {
        const response = await fetch("/api/access/status", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          errorCode?: string;
          error?: string;
          status?: AccessStatusResponse["status"];
          approved?: boolean;
        };

        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          throw new Error(apiErrorMessageFromPayload(payload, tApi, tApi.has));
        }

        if (stopped) {
          return;
        }
        setStatus(payload.status ?? "pending");

        if (payload.approved) {
          router.push("/");
          router.refresh();
        }
      } catch (caught) {
        if (!stopped) {
          const message =
            caught instanceof Error ? caught.message : tCommon("unknownError");
          setError(message);
        }
      } finally {
        if (!stopped) {
          setIsLoading(false);
        }
      }
    }

    checkStatus();
    const intervalId = setInterval(checkStatus, 8000);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6">
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LocaleSwitcher />
      </div>
      <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">{t("title")}</h1>
        <p className="mb-4 text-sm text-zinc-600">{t("description")}</p>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {t("statusLabel")}{" "}
          <span className="font-medium">
            {isLoading
              ? t("statusChecking")
              : status === "approved"
                ? t("statusApproved")
                : t("statusPending")}
          </span>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            {t("refresh")}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            {t("logout")}
          </button>
        </div>
      </section>
    </main>
  );
}
