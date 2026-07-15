import { calculateDistanceMeters } from "@/lib/conflict/distance";

export interface TimedMapSchedule {
  startMinutes: number;
  endMinutes: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  source: "own" | "group";
}

export type TimeRiskLevel = "safe" | "medium" | "high";

export interface TimeRiskSummary {
  activeCount: number;
  ownCount: number;
  groupCount: number;
  conflictPairCount: number;
  riskLevel: TimeRiskLevel;
}

export function isScheduleActiveAtTime(schedule: TimedMapSchedule, minutes: number): boolean {
  return schedule.startMinutes <= minutes && minutes < schedule.endMinutes;
}

export function summarizeSchedulesAtTime(schedules: TimedMapSchedule[], minutes: number): TimeRiskSummary {
  const activeSchedules = schedules.filter((schedule) => isScheduleActiveAtTime(schedule, minutes));
  const ownSchedules = activeSchedules.filter((schedule) => schedule.source === "own");
  const groupSchedules = activeSchedules.filter((schedule) => schedule.source === "group");
  let conflictPairCount = 0;

  for (const ownSchedule of ownSchedules) {
    for (const groupSchedule of groupSchedules) {
      const distance = calculateDistanceMeters(ownSchedule, groupSchedule);
      if (distance <= ownSchedule.radiusMeters + groupSchedule.radiusMeters) conflictPairCount += 1;
    }
  }

  return {
    activeCount: activeSchedules.length,
    ownCount: ownSchedules.length,
    groupCount: groupSchedules.length,
    conflictPairCount,
    riskLevel: conflictPairCount > 1 ? "high" : conflictPairCount === 1 ? "medium" : "safe",
  };
}
