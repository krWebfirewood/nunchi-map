import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "nunchi_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type DbClient = Prisma.TransactionClient | typeof db;

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getSessionUser(request: Request, client: DbClient = db) {
  const sessionId = cookieValue(request, SESSION_COOKIE);
  if (!sessionId) return null;
  const session = await client.session.findUnique({
    where: { id: sessionId },
    select: { id: true, expiresAt: true, user: { select: { id: true, nickname: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export function createSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function sessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}
