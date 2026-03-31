"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AccessStatusResponse = {
  status: "pending" | "approved" | "rejected";
  approved: boolean;
};

export default function WaitingAccessPage() {
  const router = useRouter();
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

        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}`);
        }

        const payload = (await response.json()) as AccessStatusResponse;
        if (stopped) {
          return;
        }
        setStatus(payload.status);

        if (payload.approved) {
          router.push("/");
          router.refresh();
        }
      } catch (caught) {
        if (!stopped) {
          const message = caught instanceof Error ? caught.message : "Unknown error";
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
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-900">
          Access verification
        </h1>
        <p className="mb-4 text-sm text-zinc-600">
          Your login is successful. Access to the table is granted manually.
          We will notify admin in Telegram and update this page automatically.
        </p>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Status:{" "}
          <span className="font-medium">
            {isLoading ? "checking..." : status}
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
            Refresh
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}
