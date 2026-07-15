import { db } from "@/lib/db";
import { findAnonymousConflicts } from "@/lib/schedules/conflicts";
import { dateToDatabaseValue, scheduleInputSchema } from "@/lib/schedules/schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const date = url.searchParams.get("date");
  if (!userId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ message: "사용자와 날짜가 필요합니다." }, { status: 400 });
  const schedules = await db.schedule.findMany({
    where: { userId, date: dateToDatabaseValue(date) },
    select: { id: true, date: true, startMinutes: true, endMinutes: true, locationName: true, latitude: true, longitude: true, radiusMeters: true },
    orderBy: { startMinutes: "asc" },
  });
  return Response.json({ schedules });
}

export async function POST(request: Request) {
  const parsed = scheduleInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "입력값을 확인해 주세요.", issues: parsed.error.flatten() }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } });
  if (!user) return Response.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  const result = await db.$transaction(async (transaction) => {
    const conflict = await findAnonymousConflicts(parsed.data, transaction);
    if (conflict.hasConflict) return { conflict, schedule: null };
    const schedule = await transaction.schedule.create({ data: { ...parsed.data, date: dateToDatabaseValue(parsed.data.date) } });
    return { conflict, schedule };
  });
  if (!result.schedule) return Response.json({ message: "익명 일정과 겹칠 가능성이 있어 저장하지 않았습니다.", conflict: result.conflict }, { status: 409 });
  const schedule = result.schedule;
  return Response.json({ schedule }, { status: 201 });
}
