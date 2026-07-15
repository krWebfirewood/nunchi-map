import { findAnonymousConflicts } from "@/lib/schedules/conflicts";
import { scheduleInputSchema } from "@/lib/schedules/schema";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = scheduleInputSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), userId: user.id });
  if (!parsed.success) return Response.json({ message: "입력값을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  return Response.json(await findAnonymousConflicts(parsed.data));
}
