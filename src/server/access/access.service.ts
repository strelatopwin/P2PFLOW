import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { accessRequestsTable } from "@/server/db/schema";
import { sendTelegramLoginRequestNotification } from "@/server/notifications/telegram.service";
import type { AccessState, AccessStatus } from "@/server/access/access.types";

const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

function mapStatus(status: string, approved: boolean): AccessStatus {
  if (approved) {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "pending";
}

async function getLatestAccessRequest(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(accessRequestsTable)
    .where(eq(accessRequestsTable.userId, userId))
    .orderBy(desc(accessRequestsTable.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function notifyIfNeeded(userId: string, email: string): Promise<void> {
  const latest = await getLatestAccessRequest(userId);
  if (!latest) {
    return;
  }
  if (latest.approved) {
    return;
  }

  const nowMs = Date.now();
  const notifiedAtMs = latest.notifiedAt ? latest.notifiedAt.getTime() : 0;
  const shouldNotify =
    !latest.notifiedAt || nowMs - notifiedAtMs >= NOTIFICATION_COOLDOWN_MS;

  if (!shouldNotify) {
    return;
  }

  await sendTelegramLoginRequestNotification({ userId, email });

  const db = getDb();
  await db
    .update(accessRequestsTable)
    .set({
      notifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(accessRequestsTable.id, latest.id));
}

export async function ensureAccessRequest(userId: string, email: string): Promise<void> {
  const latest = await getLatestAccessRequest(userId);
  if (!latest) {
    const db = getDb();
    await db.insert(accessRequestsTable).values({
      userId,
      email,
      status: "pending",
      approved: false,
    });
  } else if (latest.email !== email) {
    const db = getDb();
    await db
      .update(accessRequestsTable)
      .set({
        email,
        updatedAt: new Date(),
      })
      .where(eq(accessRequestsTable.id, latest.id));
  }

  await notifyIfNeeded(userId, email);
}

export async function getAccessState(userId: string, email: string): Promise<AccessState> {
  await ensureAccessRequest(userId, email);
  const latest = await getLatestAccessRequest(userId);

  if (!latest) {
    return { status: "pending", approved: false };
  }

  const status = mapStatus(latest.status, latest.approved);
  return {
    status,
    approved: status === "approved",
  };
}

export async function approveAccess(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(accessRequestsTable)
    .set({
      status: "approved",
      approved: true,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(accessRequestsTable.userId, userId));
}

export async function rejectAccess(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(accessRequestsTable)
    .set({
      status: "rejected",
      approved: false,
      updatedAt: new Date(),
    })
    .where(eq(accessRequestsTable.userId, userId));
}

export async function hasApprovedAccess(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(accessRequestsTable)
    .where(
      and(eq(accessRequestsTable.userId, userId), eq(accessRequestsTable.approved, true))
    );

  return Number(rows[0]?.count ?? 0) > 0;
}
