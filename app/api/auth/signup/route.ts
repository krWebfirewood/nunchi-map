import { z } from "zod";
import { createSessionCookie, sessionExpiresAt } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

const signupSchema = z.object({
  loginId: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{4,24}$/),
  password: z.string().min(8).max(72),
  nickname: z.string().trim().min(2).max(20),
});

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "아이디는 영문 소문자·숫자·밑줄 4~24자, 비밀번호는 8자 이상으로 입력해 주세요." }, { status: 400 });
  const existing = await db.user.findUnique({ where: { loginId: parsed.data.loginId }, select: { id: true } });
  if (existing) return Response.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await db.user.create({
      data: { loginId: parsed.data.loginId, passwordHash, nickname: parsed.data.nickname },
      select: { id: true, nickname: true },
    });
    const session = await db.session.create({ data: { userId: user.id, expiresAt: sessionExpiresAt() } });
    return Response.json({ user }, { status: 201, headers: { "Set-Cookie": createSessionCookie(session.id) } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return Response.json({ message: "이미 사용 중인 아이디입니다." }, { status: 409 });
    throw error;
  }
}
