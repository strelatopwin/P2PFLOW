import type { NextRequest } from "next/server";
import { jsonServerError } from "@/lib/api-error-response";
import { handleAccessApprovalRequest } from "@/server/access/access-approval.service";

export async function GET(request: NextRequest) {
  try {
    return await handleAccessApprovalRequest(request);
  } catch (caught) {
    return jsonServerError(caught);
  }
}
