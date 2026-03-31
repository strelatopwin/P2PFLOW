import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { approveAccess, rejectAccess } from "@/server/access/access.service";

type AccessApprovalStatus = "approved" | "rejected";

type ApprovalCommand = {
  userId: string | null;
  secret: string | null;
  action: string | null;
};

function isAuthorized(secret: string | null): boolean {
  return Boolean(
    secret &&
      process.env.ACCESS_APPROVAL_SECRET &&
      secret === process.env.ACCESS_APPROVAL_SECRET
  );
}

function wantsHtmlResponse(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function createHtmlRedirectResponse(status: AccessApprovalStatus): Response {
  const message =
    status === "approved"
      ? "Доступ схвалено. Перенаправляємо до таблиці..."
      : "Доступ відхилено. Перенаправляємо на головну...";

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${status === "approved" ? "Доступ схвалено" : "Доступ відхилено"}</title>
    <meta http-equiv="refresh" content="2;url=/" />
    <style>
      body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; }
      .card { max-width: 520px; margin: 120px auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
      .title { margin: 0 0 8px; font-size: 22px; }
      .text { margin: 0; color: #52525b; }
    </style>
  </head>
  <body>
    <section class="card">
      <h1 class="title">${status === "approved" ? "СХВАЛЕНО" : "ВІДХИЛЕНО"}</h1>
      <p class="text">${message}</p>
    </section>
    <script>
      setTimeout(function () { window.location.href = "/"; }, 2000);
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function executeApprovalAction(
  userId: string,
  action: string | null
): Promise<AccessApprovalStatus> {
  if (action === "reject") {
    await rejectAccess(userId);
    return "rejected";
  }

  await approveAccess(userId);
  return "approved";
}

function buildApprovalResponse(
  request: NextRequest,
  status: AccessApprovalStatus
): Response {
  if (wantsHtmlResponse(request)) {
    return createHtmlRedirectResponse(status);
  }
  return NextResponse.json({ ok: true, status });
}

export async function handleAccessApprovalRequest(
  request: NextRequest
): Promise<Response> {
  const command: ApprovalCommand = {
    userId: request.nextUrl.searchParams.get("userId"),
    secret: request.nextUrl.searchParams.get("secret"),
    action: request.nextUrl.searchParams.get("action"),
  };

  if (!isAuthorized(command.secret)) {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  if (!command.userId) {
    return NextResponse.json({ error: "Відсутній userId" }, { status: 400 });
  }

  const status = await executeApprovalAction(command.userId, command.action);
  return buildApprovalResponse(request, status);
}
