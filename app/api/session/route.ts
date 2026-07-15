import { z } from "zod";
import { clearSessionCookie, createSessionCookie, getSessionUser, SESSION_COOKIE, sessionExpiresAt } from "@/lib/auth/session";
import { db } from "@/lib/db";

const loginSchema = z.object({ userId: z.string().trim().min(1) });

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  return Response.json({ user });
}

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "사용자를 선택해 주세요." }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, nickname: true } });
  if (!user) return Response.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  const session = await db.session.create({ data: { userId: user.id, expiresAt: sessionExpiresAt() } });
  return Response.json({ user }, { headers: { "Set-Cookie": createSessionCookie(session.id) } });
}

export async function DELETE(request: Request) {
  const sessionId = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (sessionId) await db.session.deleteMany({ where: { id: decodeURIComponent(sessionId) } });
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
}
