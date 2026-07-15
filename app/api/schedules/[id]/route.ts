import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const deleted = await db.schedule.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) {
    const exists = await db.schedule.findUnique({ where: { id }, select: { id: true } });
    return Response.json({ message: exists ? "본인의 일정만 삭제할 수 있습니다." : "이미 삭제되었거나 존재하지 않는 일정입니다." }, { status: exists ? 403 : 404 });
  }
  return new Response(null, { status: 204 });
}
