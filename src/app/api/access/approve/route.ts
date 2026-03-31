import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { approveAccess, rejectAccess } from "@/server/access/access.service";

function isAuthorized(secret: string | null): boolean {
  return Boolean(secret && process.env.ACCESS_APPROVAL_SECRET && secret === process.env.ACCESS_APPROVAL_SECRET);
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const secret = request.nextUrl.searchParams.get("secret");
    const action = request.nextUrl.searchParams.get("action") ?? "approve";

    if (!isAuthorized(secret)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (action === "reject") {
      await rejectAccess(userId);
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    await approveAccess(userId);
    return NextResponse.json({ ok: true, status: "approved" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
