import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { findPeerScheduleConflicts, findScheduleConflicts, findScopedSchedulesForDate, shouldBlockScheduleCreation } from "@/lib/schedules/conflicts";
import { dateToDatabaseValue, scheduleInputSchema } from "@/lib/schedules/schema";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ message: "날짜가 필요합니다." }, { status: 400 });
  const [ownSchedules, peerSchedules, totalScheduleCount] = await Promise.all([
    db.schedule.findMany({
      where: { userId: user.id, date: dateToDatabaseValue(date) },
      select: { id: true, date: true, startMinutes: true, endMinutes: true, locationName: true, latitude: true, longitude: true, radiusMeters: true, shareWithGroups: true },
      orderBy: { startMinutes: "asc" },
    }),
    findScopedSchedulesForDate(user.id, date, db),
    db.schedule.count({ where: { userId: user.id } }),
  ]);
  const schedules = ownSchedules.map((schedule) => {
    const conflictCount = findPeerScheduleConflicts({ ...schedule, userId: user.id, date }, peerSchedules).length;
    return { ...schedule, source: "own" as const, riskLevel: conflictCount > 1 ? "high" as const : conflictCount === 1 ? "medium" as const : "low" as const };
  });
  const groupSchedules = peerSchedules.map((schedule) => ({
    id: `group-${schedule.id}`,
    startMinutes: schedule.startMinutes,
    endMinutes: schedule.endMinutes,
    locationName: schedule.locationName,
    latitude: schedule.latitude,
    longitude: schedule.longitude,
    radiusMeters: schedule.radiusMeters,
    shareWithGroups: true,
    source: "group" as const,
  }));
  return Response.json({ schedules, groupSchedules, totalScheduleCount });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = scheduleInputSchema.safeParse({ ...(typeof body === "object" && body ? body : {}), userId: user.id });
  if (!parsed.success) return Response.json({ message: "입력값을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  const result = await db.$transaction(async (transaction) => {
    const conflict = await findScheduleConflicts(parsed.data, transaction);
    if (shouldBlockScheduleCreation(conflict)) return { conflict, schedule: null };
    const schedule = await transaction.schedule.create({ data: { ...parsed.data, date: dateToDatabaseValue(parsed.data.date) } });
    return { conflict, schedule };
  });
  if (!result.schedule) return Response.json({
    message: "이미 등록한 내 일정과 시간이 겹쳐 저장하지 않았습니다.",
    conflict: result.conflict,
  }, { status: 409 });
  const schedule = result.schedule;
  return Response.json({
    schedule,
    conflict: result.conflict,
    message: result.conflict.hasConflict
      ? `일정을 등록했습니다. 그룹 일정과의 충돌 가능성이 ${result.conflict.riskLevel === "high" ? "높습니다" : "있습니다"}.`
      : "일정을 안전하게 등록했습니다.",
  }, { status: 201 });
}
