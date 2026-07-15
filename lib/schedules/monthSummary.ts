import type { Schedule } from "@prisma/client";
import { findPeerScheduleConflicts } from "@/lib/schedules/conflicts";

export type CalendarRiskStatus = "safe" | "medium" | "high" | "private";

export type CalendarDaySummary = {
  scheduleCount: number;
  sharedCount: number;
  privateCount: number;
  riskStatus: CalendarRiskStatus;
};

export type CalendarMonthSummary = Record<string, CalendarDaySummary>;

const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

export function databaseDateToString(date: Date): string {
  return new Date(date.getTime() + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthDatabaseRange(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    start: new Date(`${month}-01T00:00:00+09:00`),
    end: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`),
  };
}

export function summarizeScheduleMonth(currentUserId: string, ownSchedules: Schedule[], peerSchedules: Schedule[]): CalendarMonthSummary {
  const peersByDate = new Map<string, Schedule[]>();
  for (const schedule of peerSchedules) {
    const date = databaseDateToString(schedule.date);
    peersByDate.set(date, [...(peersByDate.get(date) ?? []), schedule]);
  }

  const ownByDate = new Map<string, Schedule[]>();
  for (const schedule of ownSchedules) {
    const date = databaseDateToString(schedule.date);
    ownByDate.set(date, [...(ownByDate.get(date) ?? []), schedule]);
  }

  return Object.fromEntries([...ownByDate.entries()].map(([date, schedules]) => {
    const peers = peersByDate.get(date) ?? [];
    const conflictCounts = schedules.map((schedule) => findPeerScheduleConflicts({
      userId: currentUserId,
      date,
      startMinutes: schedule.startMinutes,
      endMinutes: schedule.endMinutes,
      locationName: schedule.locationName,
      latitude: schedule.latitude,
      longitude: schedule.longitude,
      radiusMeters: schedule.radiusMeters,
      shareWithGroups: schedule.shareWithGroups,
    }, peers).length);
    const highestConflictCount = Math.max(0, ...conflictCounts);
    const sharedCount = schedules.filter((schedule) => schedule.shareWithGroups).length;
    const riskStatus: CalendarRiskStatus = highestConflictCount > 1
      ? "high"
      : highestConflictCount === 1
        ? "medium"
        : sharedCount === 0
          ? "private"
          : "safe";

    return [date, {
      scheduleCount: schedules.length,
      sharedCount,
      privateCount: schedules.length - sharedCount,
      riskStatus,
    }];
  }));
}
