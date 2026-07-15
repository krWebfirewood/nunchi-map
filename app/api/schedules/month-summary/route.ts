import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { uniquePeerUserIds } from "@/lib/schedules/conflicts";
import { monthDatabaseRange, summarizeScheduleMonth } from "@/lib/schedules/monthSummary";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const month = new URL(request.url).searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ message: "조회할 달을 YYYY-MM 형식으로 입력해 주세요." }, { status: 400 });
  }

  const { start, end } = monthDatabaseRange(month);
  const memberships = await db.groupMember.findMany({ where: { userId: user.id }, select: { groupId: true } });
  const groupIds = memberships.map(({ groupId }) => groupId);
  const peerMemberships = groupIds.length === 0 ? [] : await db.groupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const peerUserIds = uniquePeerUserIds(user.id, peerMemberships.map(({ userId }) => userId));
  const dateRange = { gte: start, lt: end };
  const [ownSchedules, peerSchedules] = await Promise.all([
    db.schedule.findMany({ where: { userId: user.id, date: dateRange }, orderBy: [{ date: "asc" }, { startMinutes: "asc" }] }),
    peerUserIds.length === 0
      ? Promise.resolve([])
      : db.schedule.findMany({
        where: { userId: { in: peerUserIds }, shareWithGroups: true, date: dateRange },
        orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
      }),
  ]);

  return Response.json({ month, days: summarizeScheduleMonth(user.id, ownSchedules, peerSchedules) });
}
