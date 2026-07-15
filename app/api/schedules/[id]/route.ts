import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { findScheduleConflicts, shouldBlockScheduleCreation } from "@/lib/schedules/conflicts";
import { dateToDatabaseValue, scheduleInputSchema } from "@/lib/schedules/schema";

const sharingSchema = z.object({ shareWithGroups: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const isSharingOnly = typeof body === "object" && body !== null && Object.keys(body).every((key) => key === "shareWithGroups");
  if (isSharingOnly) {
    const parsed = sharingSchema.safeParse(body);
    if (!parsed.success) return Response.json({ message: "공유 설정을 확인해 주세요." }, { status: 400 });
    const updated = await db.schedule.updateMany({
      where: { id, userId: user.id },
      data: { shareWithGroups: parsed.data.shareWithGroups },
    });
    if (updated.count === 0) {
      const exists = await db.schedule.findUnique({ where: { id }, select: { id: true } });
      return Response.json({ message: exists ? "본인의 일정만 변경할 수 있습니다." : "일정을 찾을 수 없습니다." }, { status: exists ? 403 : 404 });
    }
    return Response.json({
      shareWithGroups: parsed.data.shareWithGroups,
      message: parsed.data.shareWithGroups ? "그룹 공유를 시작했습니다." : "이 일정을 나만 보기로 변경했습니다.",
    });
  }

  const parsed = scheduleInputSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), userId: user.id });
  if (!parsed.success) return Response.json({ message: "수정할 일정 정보를 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  const result = await db.$transaction(async (transaction) => {
    const existing = await transaction.schedule.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!existing) return null;
    const conflict = await findScheduleConflicts(parsed.data, transaction, id);
    if (shouldBlockScheduleCreation(conflict)) return { conflict, schedule: null };
    const schedule = await transaction.schedule.update({
      where: { id },
      data: { ...parsed.data, date: dateToDatabaseValue(parsed.data.date), userId: user.id },
    });
    return { conflict, schedule };
  });
  if (!result) {
    const exists = await db.schedule.findUnique({ where: { id }, select: { id: true } });
    return Response.json({ message: exists ? "본인의 일정만 변경할 수 있습니다." : "일정을 찾을 수 없습니다." }, { status: exists ? 403 : 404 });
  }
  if (!result.schedule) return Response.json({ message: "다른 내 일정과 시간이 겹쳐 수정하지 않았습니다.", conflict: result.conflict }, { status: 409 });
  return Response.json({
    schedule: result.schedule,
    conflict: result.conflict,
    message: result.conflict.hasConflict ? "일정을 수정했습니다. 그룹 일정과의 충돌 가능성이 있습니다." : "일정을 수정했습니다.",
  });
}

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
