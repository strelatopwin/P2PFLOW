import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
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

/** Legacy rows: approved with no device yet — bind first seen device without a new Telegram round-trip. */
async function bindLegacyApprovedDevice(
  userId: string,
  deviceId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(accessRequestsTable)
    .set({
      approvedDeviceId: deviceId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accessRequestsTable.userId, userId),
        eq(accessRequestsTable.approved, true),
        isNull(accessRequestsTable.approvedDeviceId),
      ),
    );
}

function accessSatisfiedForDevice(
  latest: {
    approved: boolean;
    approvedDeviceId: string | null;
  },
  deviceId: string,
): boolean {
  return (
    latest.approved &&
    latest.approvedDeviceId !== null &&
    latest.approvedDeviceId === deviceId
  );
}

async function notifyIfNeeded(
  userId: string,
  email: string,
  deviceId: string,
): Promise<void> {
  const latest = await getLatestAccessRequest(userId);
  if (!latest) {
    return;
  }

  if (accessSatisfiedForDevice(latest, deviceId)) {
    return;
  }

  const db = getDb();
  const now = new Date();
  const cooldownCutoff = new Date(Date.now() - NOTIFICATION_COOLDOWN_MS);

  /** Claim slot in DB first so concurrent requests cannot all pass cooldown before Telegram returns. */
  const claimed = await db
    .update(accessRequestsTable)
    .set({
      notifiedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(accessRequestsTable.id, latest.id),
        or(
          isNull(accessRequestsTable.notifiedAt),
          lte(accessRequestsTable.notifiedAt, cooldownCutoff),
        ),
      ),
    )
    .returning({ id: accessRequestsTable.id });

  if (claimed.length === 0) {
    return;
  }

  try {
    await sendTelegramLoginRequestNotification({ userId, email, deviceId });
  } catch (error) {
    console.error("[access] Telegram notification failed:", error);
    await db
      .update(accessRequestsTable)
      .set({
        notifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(accessRequestsTable.id, latest.id));
  }
}

export async function ensureAccessRequest(
  userId: string,
  email: string,
  deviceId: string,
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

  await bindLegacyApprovedDevice(userId, deviceId);
  await notifyIfNeeded(userId, email, deviceId);
}

export async function getAccessState(
  userId: string,
  email: string,
  deviceId: string,
): Promise<AccessState> {
  if (isAccessRequestExemptEmail(email)) {
    return {
      status: "approved",
      approved: true,
    };
  }

  await ensureAccessRequest(userId, email, deviceId);
  const latest = await getLatestAccessRequest(userId);

  if (!latest) {
    return { status: "pending", approved: false };
  }

  const approved = accessSatisfiedForDevice(latest, deviceId);
  const status = mapStatus(approved);
  return {
    status,
    approved,
  };
}

export async function approveAccess(
  userId: string,
  deviceId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(accessRequestsTable)
    .set({
      approved: true,
      approvedAt: new Date(),
      approvedDeviceId: deviceId,
      /** Allow immediate Telegram for another device/session (cooldown must not block them). */
      notifiedAt: null,
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
      approvedDeviceId: null,
      notifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(accessRequestsTable.userId, userId));
}

export async function hasApprovedAccess(
  userId: string,
  email: string,
  deviceId: string,
): Promise<boolean> {
  if (isAccessRequestExemptUserId(userId)) {
    return true;
  }

  await ensureAccessRequest(userId, email, deviceId);
  const latest = await getLatestAccessRequest(userId);
  if (!latest) {
    return false;
  }
  return accessSatisfiedForDevice(latest, deviceId);
}
