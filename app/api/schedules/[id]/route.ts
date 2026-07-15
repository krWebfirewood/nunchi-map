import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const schedule = await db.schedule.findUnique({ where: { id }, select: { userId: true } });
  if (!schedule) return Response.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  if (schedule.userId !== user.id) return Response.json({ message: "본인의 일정만 삭제할 수 있습니다." }, { status: 403 });
  await db.schedule.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
