import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { accessRequestsTable } from "@/server/db/schema";
import { sendTelegramLoginRequestNotification } from "@/server/notifications/telegram.service";
import type { AccessState, AccessStatus } from "@/server/access/access.types";
import { createUserIdFromEmail } from "@/server/auth/auth.session";

const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

function mapStatus(approved: boolean): AccessStatus {
  if (approved) {
    return "approved";
  }
  return "pending";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isAccessRequestExemptEmail(email: string): boolean {
  const exemptEmail = process.env.PROFIT_ARBITRAGE_LOGIN;
  if (!exemptEmail) {
    return false;
  }
  return normalizeEmail(email) === normalizeEmail(exemptEmail);
}

function isAccessRequestExemptUserId(userId: string): boolean {
  const exemptEmail = process.env.PROFIT_ARBITRAGE_LOGIN;
  if (!exemptEmail) {
    return false;
  }
  return userId === createUserIdFromEmail(exemptEmail);
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

export async function ensureAccessRequest(
  userId: string,
  email: string,
): Promise<void> {
  if (isAccessRequestExemptEmail(email)) {
    return;
  }

  const latest = await getLatestAccessRequest(userId);
  if (!latest) {
    const db = getDb();
    await db.insert(accessRequestsTable).values({
      userId,
      email,
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

export async function getAccessState(
  userId: string,
  email: string,
): Promise<AccessState> {
  if (isAccessRequestExemptEmail(email)) {
    return {
      status: "approved",
      approved: true,
    };
  }

  await ensureAccessRequest(userId, email);
  const latest = await getLatestAccessRequest(userId);

  if (!latest) {
    return { status: "pending", approved: false };
  }

  const status = mapStatus(latest.approved);
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
      approved: false,
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(accessRequestsTable.userId, userId));
}

export async function hasApprovedAccess(userId: string): Promise<boolean> {
  if (isAccessRequestExemptUserId(userId)) {
    return true;
  }

  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(accessRequestsTable)
    .where(
      and(
        eq(accessRequestsTable.userId, userId),
        eq(accessRequestsTable.approved, true),
      ),
    );

  return Number(rows[0]?.count ?? 0) > 0;
}
