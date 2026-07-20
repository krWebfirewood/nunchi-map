import { calculateDistanceMeters } from "@/lib/conflict/distance";

export type PinMood = "neutral" | "happy" | "worried" | "frown";

export interface PinSchedule {
  id: string;
  startMinutes: number;
  endMinutes: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export function pinMoodForRiskLevel(riskLevel: "low" | "medium" | "high" | null): PinMood {
  if (riskLevel === "low") return "happy";
  if (riskLevel === "medium") return "worried";
  if (riskLevel === "high") return "frown";
  return "neutral";
}

export function pinMoodForConflictCount(conflictCount: number): PinMood {
  if (conflictCount <= 0) return "happy";
  if (conflictCount === 1) return "worried";
  return "frown";
}

export function scheduleConflictCountInRange(target: PinSchedule, schedules: PinSchedule[], startMinutes: number, endMinutes: number): number {
  return schedules.filter((other) => {
    if (other.id === target.id) return false;
    const overlapStart = Math.max(target.startMinutes, other.startMinutes, startMinutes);
    const overlapEnd = Math.min(target.endMinutes, other.endMinutes, endMinutes);
    if (overlapStart >= overlapEnd) return false;
    return calculateDistanceMeters(target, other) <= target.radiusMeters + other.radiusMeters;
  }).length;
}
