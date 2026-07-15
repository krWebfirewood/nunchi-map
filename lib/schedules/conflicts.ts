import type { Prisma, Schedule } from "@prisma/client";
import { calculateConflict } from "@/lib/conflict/calculateConflict";
import { hasTimeOverlap } from "@/lib/conflict/timeOverlap";
import { db } from "@/lib/db";
import { dateToDatabaseValue, type ScheduleInput } from "./schema";

export interface AnonymousConflictResult {
  hasConflict: boolean;
  ownScheduleConflict: boolean;
  anonymousConflictCount: number;
  overlapWindow: { startMinutes: number; endMinutes: number } | null;
  riskLevel: "low" | "medium" | "high";
}

export function shouldBlockScheduleCreation(conflict: AnonymousConflictResult): boolean {
  return conflict.ownScheduleConflict;
}

export function uniquePeerUserIds(currentUserId: string, memberUserIds: string[]): string[] {
  return [...new Set(memberUserIds)].filter((userId) => userId !== currentUserId);
}

export async function findScopedSchedulesForDate(userId: string, date: string, client: Prisma.TransactionClient | typeof db = db): Promise<Schedule[]> {
  const memberships = await client.groupMember.findMany({ where: { userId }, select: { groupId: true } });
  const groupIds = memberships.map(({ groupId }) => groupId);
  const peerMemberships = groupIds.length === 0 ? [] : await client.groupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const peerUserIds = uniquePeerUserIds(userId, peerMemberships.map(({ userId }) => userId));
  if (peerUserIds.length === 0) return [];
  return client.schedule.findMany({ where: { date: dateToDatabaseValue(date), userId: { in: peerUserIds }, shareWithGroups: true }, orderBy: { startMinutes: "asc" } });
}

export async function findScopedSchedules(input: ScheduleInput, client: Prisma.TransactionClient | typeof db = db): Promise<Schedule[]> {
  return findScopedSchedulesForDate(input.userId, input.date, client);
}

export async function findOwnSchedules(input: ScheduleInput, client: Prisma.TransactionClient | typeof db = db, excludeScheduleId?: string): Promise<Schedule[]> {
  return client.schedule.findMany({ where: { date: dateToDatabaseValue(input.date), userId: input.userId, ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}) } });
}

function overlapWindow(input: ScheduleInput, schedules: Schedule[]): AnonymousConflictResult["overlapWindow"] {
  if (schedules.length === 0) return null;
  return {
    startMinutes: Math.min(...schedules.map((schedule) => Math.max(input.startMinutes, schedule.startMinutes))),
    endMinutes: Math.max(...schedules.map((schedule) => Math.min(input.endMinutes, schedule.endMinutes))),
  };
}

export function findPeerScheduleConflicts(input: ScheduleInput, schedules: Schedule[]): Schedule[] {
  return schedules.filter((schedule) => calculateConflict(input, {
    date: input.date,
    startMinutes: schedule.startMinutes,
    endMinutes: schedule.endMinutes,
    latitude: schedule.latitude,
    longitude: schedule.longitude,
    radiusMeters: schedule.radiusMeters,
  }).isConflict);
}

export async function findScheduleConflicts(input: ScheduleInput, client: Prisma.TransactionClient | typeof db = db, excludeScheduleId?: string): Promise<AnonymousConflictResult> {
  const [ownSchedules, peerSchedules] = await Promise.all([findOwnSchedules(input, client, excludeScheduleId), findScopedSchedules(input, client)]);
  const ownConflicts = ownSchedules.filter((schedule) => hasTimeOverlap(input, schedule));
  const anonymousConflicts = findPeerScheduleConflicts(input, peerSchedules);
  const count = anonymousConflicts.length;
  const ownScheduleConflict = ownConflicts.length > 0;
  return {
    hasConflict: ownScheduleConflict || count > 0,
    ownScheduleConflict,
    anonymousConflictCount: count,
    overlapWindow: overlapWindow(input, ownScheduleConflict ? ownConflicts : anonymousConflicts),
    riskLevel: ownScheduleConflict || count > 1 ? "high" : count === 1 ? "medium" : "low",
  };
}
