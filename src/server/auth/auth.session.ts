import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "@/server/auth/auth.service";

type SessionPayload = {
  userId: string;
  email: string;
  deviceId: string;
  exp: number;
};

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidDeviceId(value: string): boolean {
  return UUID_V4_RE.test(value);
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createUserIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex");
  return `email_${hash.slice(0, 24)}`;
}

export function createSessionToken(email: string, deviceId: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const payload: SessionPayload = {
    userId: createUserIdFromEmail(normalizedEmail),
    email: normalizedEmail,
    deviceId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(token: string | undefined): AuthenticatedUser | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return null;
  }
  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (!parsed.userId || !parsed.email || !parsed.exp || !parsed.deviceId) {
      return null;
    }
    if (!isValidDeviceId(parsed.deviceId)) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: parsed.userId,
      email: parsed.email,
      deviceId: parsed.deviceId,
    };
  } catch {
    return null;
  }
}
