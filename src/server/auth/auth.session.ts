import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "@/server/auth/auth.service";

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

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

export function createSessionToken(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const payload: SessionPayload = {
    userId: createUserIdFromEmail(normalizedEmail),
    email: normalizedEmail,
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
    if (!parsed.userId || !parsed.email || !parsed.exp) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: parsed.userId,
      email: parsed.email,
    };
  } catch {
    return null;
  }
}
