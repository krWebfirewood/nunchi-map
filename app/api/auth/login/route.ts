import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, sessionExpiresAt } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { databaseUnavailableResponse } from "@/lib/http/database";

const loginSchema = z.object({
  loginId: z.string().trim().toLowerCase().min(1).max(24),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "아이디와 비밀번호를 입력해 주세요." }, { status: 400 });
  try {
    const account = await db.user.findUnique({ where: { loginId: parsed.data.loginId }, select: { id: true, nickname: true, passwordHash: true } });
    const valid = account?.passwordHash ? await verifyPassword(parsed.data.password, account.passwordHash) : false;
    if (!account || !valid) return Response.json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    const session = await db.session.create({ data: { userId: account.id, expiresAt: sessionExpiresAt() } });
    return Response.json({ user: { id: account.id, nickname: account.nickname } }, { headers: { "Set-Cookie": createSessionCookie(session.id) } });
  } catch (error) {
    return databaseUnavailableResponse("account login failed", error);
  }
}
