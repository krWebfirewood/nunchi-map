import type { Schedule } from "@prisma/client";
import { calculateConflict } from "@/lib/conflict/calculateConflict";
import { calculateDistanceMeters } from "@/lib/conflict/distance";
import { hasTimeOverlap } from "@/lib/conflict/timeOverlap";
import { DEMO_LOCATIONS } from "@/lib/locations";
import type { ScheduleInput } from "@/lib/schedules/schema";

export type RecommendationCandidate = {
  id: string;
  type: "location" | "time";
  title: string;
  description: string;
  locationName: string;
  latitude: number;
  longitude: number;
  startMinutes: number;
  endMinutes: number;
  estimatedRisk: "low";
};

type ExistingSchedule = Pick<Schedule, "startMinutes" | "endMinutes" | "latitude" | "longitude" | "radiusMeters">;

function isSafe(input: ScheduleInput, peerSchedules: ExistingSchedule[], ownSchedules: ExistingSchedule[]): boolean {
  if (ownSchedules.some((schedule) => hasTimeOverlap(input, schedule))) return false;
  return peerSchedules.every((schedule) => !calculateConflict(input, {
    date: input.date,
    startMinutes: schedule.startMinutes,
    endMinutes: schedule.endMinutes,
    latitude: schedule.latitude,
    longitude: schedule.longitude,
    radiusMeters: schedule.radiusMeters,
  }).isConflict);
}

function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function generateSafeCandidates(input: ScheduleInput, peerSchedules: ExistingSchedule[], ownSchedules: ExistingSchedule[] = []): RecommendationCandidate[] {
  const locationCandidates = DEMO_LOCATIONS
    .filter((location) => location.name !== input.locationName)
    .map((location) => ({
      location,
      distance: calculateDistanceMeters(input, location),
      candidateInput: { ...input, locationName: location.name, latitude: location.latitude, longitude: location.longitude },
    }))
    .filter(({ candidateInput }) => isSafe(candidateInput, peerSchedules, ownSchedules))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2)
    .map(({ location, distance, candidateInput }): RecommendationCandidate => ({
      id: `location:${location.name}`,
      type: "location",
      title: `${location.name}으로 장소 변경`,
      description: `현재 장소에서 약 ${(distance / 1000).toFixed(1)}km 떨어진 안전 후보입니다.`,
      locationName: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      startMinutes: candidateInput.startMinutes,
      endMinutes: candidateInput.endMinutes,
      estimatedRisk: "low",
    }));

  const duration = input.endMinutes - input.startMinutes;
  const firstStart = Math.ceil(input.endMinutes / 30) * 30;
  const timeCandidates: RecommendationCandidate[] = [];
  for (let startMinutes = firstStart; startMinutes + duration <= 1440 && timeCandidates.length < 2; startMinutes += 30) {
    const candidateInput = { ...input, startMinutes, endMinutes: startMinutes + duration };
    if (!isSafe(candidateInput, peerSchedules, ownSchedules)) continue;
    timeCandidates.push({
      id: `time:${startMinutes}`,
      type: "time",
      title: `${formatMinutes(startMinutes)}–${formatMinutes(startMinutes + duration)}로 시간 변경`,
      description: "같은 날짜와 장소를 유지하는 안전 후보입니다.",
      locationName: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      startMinutes,
      endMinutes: startMinutes + duration,
      estimatedRisk: "low",
    });
  }

  return [...locationCandidates, ...timeCandidates];
}
