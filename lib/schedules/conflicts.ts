import type { Prisma, Schedule } from "@prisma/client";
import { calculateConflict } from "@/lib/conflict/calculateConflict";
import { db } from "@/lib/db";
import { dateToDatabaseValue, type ScheduleInput } from "./schema";

export interface AnonymousConflictResult {
  hasConflict: boolean;
  anonymousConflictCount: number;
  overlapWindow: { startMinutes: number; endMinutes: number } | null;
  riskLevel: "low" | "medium" | "high";
}

export async function findScopedSchedules(input: ScheduleInput, client: Prisma.TransactionClient | typeof db = db): Promise<Schedule[]> {
  const memberships = await client.groupMember.findMany({ where: { userId: input.userId }, select: { groupId: true } });
  const groupIds = memberships.map(({ groupId }) => groupId);
  const peerMemberships = groupIds.length === 0 ? [] : await client.groupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const userIds = [...new Set([input.userId, ...peerMemberships.map(({ userId }) => userId)])];
  return client.schedule.findMany({ where: { date: dateToDatabaseValue(input.date), userId: { in: userIds } } });
}

function overlapWindow(input: ScheduleInput, schedules: Schedule[]): AnonymousConflictResult["overlapWindow"] {
  if (schedules.length === 0) return null;
  return {
    startMinutes: Math.min(...schedules.map((schedule) => Math.max(input.startMinutes, schedule.startMinutes))),
    endMinutes: Math.max(...schedules.map((schedule) => Math.min(input.endMinutes, schedule.endMinutes))),
  };
}

export async function findAnonymousConflicts(input: ScheduleInput, client: Prisma.TransactionClient | typeof db = db): Promise<AnonymousConflictResult> {
  const schedules = await findScopedSchedules(input, client);
  const conflicts = schedules.filter((schedule) => calculateConflict(input, {
    date: input.date,
    startMinutes: schedule.startMinutes,
    endMinutes: schedule.endMinutes,
    latitude: schedule.latitude,
    longitude: schedule.longitude,
    radiusMeters: schedule.radiusMeters,
  }).isConflict);
  const count = conflicts.length;
  return {
    hasConflict: count > 0,
    anonymousConflictCount: count,
    overlapWindow: overlapWindow(input, conflicts),
    riskLevel: count === 0 ? "low" : count === 1 ? "medium" : "high",
  };
}
