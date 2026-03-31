import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleAccessApprovalRequest } from "@/server/access/access-approval.service";

export async function GET(request: NextRequest) {
  try {
    return await handleAccessApprovalRequest(request);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
